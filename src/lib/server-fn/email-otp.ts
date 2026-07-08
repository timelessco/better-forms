import { createServerFn } from "@tanstack/react-start";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import type { Value } from "platejs";
import { db } from "@/db";
import { forms, formVersions } from "@/db/schema";
import { sendEmailVerificationCode } from "@/integrations/email";
import { createError } from "@/lib/errors/create";
import type { ErrorCode } from "@/lib/errors/codes";
import {
  getEditableFields,
  transformPlateStateToFormElements,
} from "@/lib/editor/transform-plate-to-form";
import { hmac, pack, timingSafeEqualStr, unpack } from "./email-otp.server";

/**
 * Stateless email OTP for the public-form "Verify email" field — no DB table (migrations are
 * frozen in this repo). The send step returns a signed challenge embedding an HMAC of the code;
 * verify exchanges challenge+code for a signed verified-token; createPublicSubmission trusts only
 * that token (see email-otp.server.ts for the token scheme). Codes can't be brute-forced offline:
 * the embedded hash is HMAC(secret, …), and online attempts are capped per challenge.
 *
 * This module must export ONLY createServerFn values — plain exports would drag node:crypto into
 * the client bundle (EmailField imports the RPC stubs from here).
 */

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const VERIFIED_TTL_MS = 2 * 60 * 60 * 1000; // long enough to finish a long form
const SEND_MIN_INTERVAL_MS = 30_000;
const SEND_HOURLY_CAP = 5;
const VERIFY_MAX_ATTEMPTS = 5;
const RATE_MAP_MAX_ENTRIES = 10_000;

// In-memory, per-instance rate limits (same best-effort pattern as the draft throttle).
const sendLog = new Map<string, number[]>();
const verifyAttempts = new Map<string, number>();

const pruneMap = (map: Map<string, unknown>) => {
  if (map.size <= RATE_MAP_MAX_ENTRIES) return;
  // Insertion order ≈ oldest first; drop the front half.
  let toDrop = map.size / 2;
  for (const key of map.keys()) {
    if (toDrop-- <= 0) break;
    map.delete(key);
  }
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Mint a 6-digit code + signed challenge and email the code. */
export const sendEmailOtp = createServerFn({ method: "POST" })
  .validator(
    v.object({
      formId: v.pipe(v.string(), v.uuid()),
      email: v.pipe(v.string(), v.trim(), v.email(), v.maxLength(320)),
    }),
  )
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);

    const rateKey = `${data.formId}:${email}`;
    const now = Date.now();
    const recent = (sendLog.get(rateKey) ?? []).filter((t) => now - t < 60 * 60 * 1000);
    if (recent.length >= SEND_HOURLY_CAP || now - (recent.at(-1) ?? 0) < SEND_MIN_INTERVAL_MS) {
      throw createError({
        code: "otp/rate-limited" satisfies ErrorCode,
        status: 429,
        message: "Too many codes requested — wait before trying again",
        why: "Per-email send throttle hit (30s min interval, 5/hour cap)",
        fix: "Wait a moment, then press Resend",
      });
    }

    const [form] = await db
      .select({
        status: forms.status,
        title: forms.title,
        lastPublishedVersionId: forms.lastPublishedVersionId,
      })
      .from(forms)
      .where(eq(forms.id, data.formId));

    if (!form || form.status !== "published" || !form.lastPublishedVersionId) {
      throw createError({
        code: "forms/not-found" satisfies ErrorCode,
        status: 404,
        message: "Form not found or not published",
        why: "OTP sends are only allowed for published forms",
        fix: "Publish the form first",
        internal: { formId: data.formId },
      });
    }

    const [version] = await db
      .select({ content: formVersions.content })
      .from(formVersions)
      .where(eq(formVersions.id, form.lastPublishedVersionId));

    // Refuse unless the published form actually has a verify-email field — otherwise this
    // endpoint is an open email-bombing relay.
    const fields = version?.content
      ? getEditableFields(transformPlateStateToFormElements(version.content as Value))
      : [];
    const hasVerifyEmailField = fields.some(
      (f) => f.fieldType === "Email" && f.verifyEmail === true,
    );
    if (!hasVerifyEmailField) {
      throw createError({
        code: "otp/not-applicable" satisfies ErrorCode,
        status: 400,
        message: "This form does not require email verification",
        why: "No published Email field has the Verify email toggle enabled",
        fix: "Enable Verify email on the field and republish",
        internal: { formId: data.formId },
      });
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const salt = randomInt(0, Number.MAX_SAFE_INTEGER).toString(36);

    await sendEmailVerificationCode(email, code, form.title || "this form");

    recent.push(now);
    sendLog.set(rateKey, recent);
    pruneMap(sendLog);

    return {
      challenge: pack({
        t: "challenge",
        e: email,
        f: data.formId,
        s: salt,
        h: hmac(`otp|${email}|${data.formId}|${salt}|${code}`),
        x: now + CHALLENGE_TTL_MS,
      }),
    };
  });

/** Exchange challenge + code for a verified token the submit endpoint trusts. */
export const verifyEmailOtp = createServerFn({ method: "POST" })
  .validator(
    v.object({
      challenge: v.pipe(v.string(), v.maxLength(2048)),
      code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
    }),
  )
  .handler(async ({ data }) => {
    const payload = unpack(data.challenge);
    const invalid = () =>
      createError({
        code: "otp/invalid-code" satisfies ErrorCode,
        status: 400,
        message: "That code didn't match — check the email and try again",
        why: "Code doesn't match the challenge (or the challenge is malformed)",
        fix: "Re-enter the 6-digit code from the email, or press Resend",
      });

    if (!payload || payload.t !== "challenge") throw invalid();

    const { e, f, s, h, x } = payload as { e: string; f: string; s: string; h: string; x: number };
    if (typeof x !== "number" || Date.now() > x) {
      throw createError({
        code: "otp/expired" satisfies ErrorCode,
        status: 400,
        message: "That code has expired — request a new one",
        why: "Challenge TTL (10 minutes) elapsed",
        fix: "Press Resend to get a fresh code",
      });
    }

    // Online brute-force cap, keyed by the challenge signature.
    const attemptKey = data.challenge.slice(-32);
    const tries = (verifyAttempts.get(attemptKey) ?? 0) + 1;
    verifyAttempts.set(attemptKey, tries);
    pruneMap(verifyAttempts);
    if (tries > VERIFY_MAX_ATTEMPTS) {
      throw createError({
        code: "otp/rate-limited" satisfies ErrorCode,
        status: 429,
        message: "Too many attempts — request a new code",
        why: "Attempt cap for this challenge exceeded",
        fix: "Press Resend to get a fresh code",
      });
    }

    if (!timingSafeEqualStr(h ?? "", hmac(`otp|${e}|${f}|${s}|${data.code}`))) {
      throw invalid();
    }

    verifyAttempts.delete(attemptKey);
    return {
      verifiedToken: pack({ t: "verified", e, f, x: Date.now() + VERIFIED_TTL_MS }),
    };
  });
