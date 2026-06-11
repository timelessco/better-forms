import "@tanstack/react-start/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Stateless HMAC token helpers for the public-form "Verify email" OTP. Server-only —
 * node:crypto must never reach the client bundle (email-otp.ts keeps only the RPC surface). */

const getSecret = (): string => {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is required for email OTP");
  return s;
};

export const hmac = (payload: string): string =>
  createHmac("sha256", getSecret()).update(payload).digest("base64url");

export const pack = (payload: Record<string, unknown>): string => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
};

export const unpack = (token: string): Record<string, unknown> | null => {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(hmac(body));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const timingSafeEqualStr = (a: string, b: string): boolean => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Server-side check used by createPublicSubmission: does `token` prove `email` was verified
 * for `formId`? Pure function — no I/O. */
export const isEmailVerifiedToken = (token: string, email: string, formId: string): boolean => {
  const payload = unpack(token);
  if (!payload || payload.t !== "verified") return false;
  const { e, f, x } = payload as { e: string; f: string; x: number };
  return e === normalizeEmail(email) && f === formId && typeof x === "number" && Date.now() < x;
};
