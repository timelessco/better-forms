import { log } from "evlog";
import { createServerFn } from "@tanstack/react-start";
import { and, count, eq, sql } from "drizzle-orm";
import { createError } from "@/lib/errors/create";
import * as v from "valibot";
import type { Value } from "platejs";
import {
  formVisits,
  forms,
  formVersions,
  organization,
  submissions,
  user,
  workspaces,
} from "@/db/schema";
import { db } from "@/db";
import { planUnlocks } from "@/lib/config/plan-gates";
import {
  getEditableFields,
  transformPlateStateToFormElements,
} from "@/lib/editor/transform-plate-to-form";
import type { ErrorCode } from "@/lib/errors/codes";
import { buildVisibleSchema, sanitizeSubmission } from "@/lib/logic/sanitize-submission";
import { isEmailVerifiedToken } from "./email-otp.server";
import { isServerPlan } from "./plan-helpers";
import { recordOwnerSubmissionNotification } from "./notifications-helpers.server";
import { upsertSubmissionByDraft } from "./public-submissions-upsert.server";
import { sendFormSubmissionNotification, sendRespondentConfirmation } from "@/integrations/email";

// Gate-relevant subset of forms.settings actually read server-side. looseObject so
// the full stored blob's extra keys don't fail the parse; each field optional/nullable.
const versionSettingsSchema = v.looseObject({
  closeForm: v.optional(v.boolean()),
  closeOnDate: v.optional(v.boolean()),
  closeDate: v.optional(v.nullable(v.string())),
  limitSubmissions: v.optional(v.boolean()),
  maxSubmissions: v.optional(v.nullable(v.number())),
  selfEmailNotifications: v.optional(v.boolean()),
  notificationEmail: v.optional(v.nullable(v.string())),
  respondentEmailNotifications: v.optional(v.boolean()),
  respondentEmailSubject: v.optional(v.nullable(v.string())),
  respondentEmailBody: v.optional(v.nullable(v.string())),
});
type VersionSettings = v.InferOutput<typeof versionSettingsSchema>;

// Inlined waitUntil: @vercel/functions re-exports ./cache → @vercel/oidc CJS, which
// Vite 7's dev module runner can't eval (crashes dev). Read Vercel's Symbol-keyed
// request-context global directly; non-Vercel: symbol unset, promise runs unattached.
const VERCEL_REQUEST_CONTEXT = Symbol.for("@vercel/request-context");
const waitUntil = (promise: Promise<unknown>) => {
  const ctx = (
    globalThis as {
      [k: symbol]: { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } | undefined;
    }
  )[VERCEL_REQUEST_CONTEXT];
  ctx?.get?.()?.waitUntil?.(promise);
};

// Draft-save payload cap: stops malicious clients stuffing blobs into anon public rows.
const MAX_DRAFT_PAYLOAD_BYTES = 100_000;
// Min interval between draft upserts per draftId; defends against runaway/malicious client.
const DRAFT_RATE_LIMIT_MS = 900;

// In-memory per-process rate-limit map (single-node only; swap for Redis/KV if scaling
// horizontally). Bounded via opportunistic eviction in handler.
const draftLastWriteAt = new Map<string, number>();
const DRAFT_RATE_LIMIT_TTL_MS = DRAFT_RATE_LIMIT_MS * 20;
const DRAFT_RATE_LIMIT_MAX_ENTRIES = 10_000;

// Per-version allowed-field-name cache: version content is immutable per id, transform once.
const ALLOWED_FIELDS_CACHE_MAX = 500;
const allowedFieldsByVersion = new Map<string, Set<string>>();

const getAllowedFieldNames = (versionId: string | null, content: Value): Set<string> | null => {
  if (!versionId) return null;
  const cached = allowedFieldsByVersion.get(versionId);
  if (cached) return cached;
  try {
    const fields = getEditableFields(transformPlateStateToFormElements(content));
    const set = new Set(fields.map((f) => f.name));
    if (allowedFieldsByVersion.size >= ALLOWED_FIELDS_CACHE_MAX) {
      const firstKey = allowedFieldsByVersion.keys().next().value;
      if (firstKey) allowedFieldsByVersion.delete(firstKey);
    }
    allowedFieldsByVersion.set(versionId, set);
    return set;
  } catch {
    return null;
  }
};

/**
 * Public submission endpoint (no auth). Two modes (see CONTEXT.md):
 *   - Incomplete (isCompleted:false + draftId): upsert on (formId, draftId), shape-only
 *     validation, rate-limited per draftId. draftId = client autosave-session id, not a state label.
 *   - Completed (isCompleted:true): full validation via published schema; updates matching
 *     incomplete row in place; refuses to downgrade an already-completed row.
 * Gating + email settings read from published version snapshot, so unpublished changes
 * don't take effect until republish.
 */
export const createPublicSubmission = createServerFn({ method: "POST" })
  .inputValidator(
    v.object({
      formId: v.pipe(v.string(), v.uuid()),
      data: v.record(v.string(), v.any()),
      isCompleted: v.optional(v.boolean(), true),
      draftId: v.optional(v.pipe(v.string(), v.uuid())),
      lastStepReached: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
      visitId: v.nullish(v.pipe(v.string(), v.uuid())),
      /** fieldName → verified token from verifyEmailOtp, for "Verify email" fields. */
      emailVerification: v.optional(v.record(v.string(), v.pipe(v.string(), v.maxLength(2048)))),
    }),
  )
  .handler(async ({ data }) => {
    // Payload guard for incomplete only; completed submits trust published schema's validators.
    if (!data.isCompleted) {
      const payloadSize = JSON.stringify(data.data).length;
      if (payloadSize > MAX_DRAFT_PAYLOAD_BYTES) {
        throw createError({
          code: "submissions/draft-too-large" satisfies ErrorCode,
          status: 400,
          message: "Draft payload too large",
          why: `Encoded draft body exceeds the ${MAX_DRAFT_PAYLOAD_BYTES}-byte cap`,
          fix: "Remove some answers or finalize the submission",
          internal: { byteSize: payloadSize, maxBytes: MAX_DRAFT_PAYLOAD_BYTES },
        });
      }
      if (!data.draftId) {
        throw createError({
          code: "submissions/missing-draft-id" satisfies ErrorCode,
          status: 400,
          message: "draftId is required for partial submissions",
          why: "Server can't upsert a draft row without a stable draftId",
          fix: "Generate and persist a draftId before saving partial responses",
        });
      }
      const now = Date.now();
      const lastAt = draftLastWriteAt.get(data.draftId) ?? 0;
      if (now - lastAt < DRAFT_RATE_LIMIT_MS) {
        return { submissionId: null, success: true, throttled: true };
      }
      draftLastWriteAt.set(data.draftId, now);
      if (draftLastWriteAt.size > DRAFT_RATE_LIMIT_MAX_ENTRIES) {
        for (const [key, ts] of draftLastWriteAt) {
          if (now - ts > DRAFT_RATE_LIMIT_TTL_MS) draftLastWriteAt.delete(key);
        }
      }
    }

    const [form] = await db
      .select({
        status: forms.status,
        lastPublishedVersionId: forms.lastPublishedVersionId,
        createdByUserId: forms.createdByUserId,
        orgPlan: organization.plan,
      })
      .from(forms)
      .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
      .innerJoin(organization, eq(organization.id, workspaces.organizationId))
      .where(eq(forms.id, data.formId));

    if (!form) {
      throw createError({
        code: "forms/not-found" satisfies ErrorCode,
        status: 404,
        message: "Form not found",
        why: "No form row matched the submitted formId",
        fix: "Check the form URL — it may have been deleted",
        internal: { formId: data.formId },
      });
    }

    if (form.status !== "published") {
      throw createError({
        code: "forms/closed" satisfies ErrorCode,
        status: 403,
        message: "Form is not accepting submissions",
        why: `Form status is "${form.status}" — only "published" forms accept submissions`,
        fix: "Wait for the form owner to publish it",
        internal: { formId: data.formId, status: form.status },
      });
    }

    const [version] = form.lastPublishedVersionId
      ? await db
          .select({ settings: formVersions.settings, content: formVersions.content })
          .from(formVersions)
          .where(eq(formVersions.id, form.lastPublishedVersionId))
      : [undefined];

    // Validate the stored settings blob; on malformed/empty input fall back to {} so the
    // gates below read as undefined → permissive (preserves prior `?? {}` behavior).
    const parsedSettings = v.safeParse(versionSettingsSchema, version?.settings ?? {});
    const vSettings: VersionSettings = parsedSettings.success ? parsedSettings.output : {};

    // --- Server-side gating (prevent client-side bypass) ---
    if (vSettings.closeForm) {
      throw createError({
        code: "forms/closed" satisfies ErrorCode,
        status: 403,
        message: "This form is closed",
        why: "Form owner toggled `closeForm` on the published version",
        fix: "Contact the form owner if you believe this is a mistake",
        internal: { formId: data.formId },
      });
    }
    if (
      vSettings.closeOnDate &&
      vSettings.closeDate &&
      new Date(vSettings.closeDate) < new Date()
    ) {
      throw createError({
        code: "forms/closed" satisfies ErrorCode,
        status: 403,
        message: "This form is no longer accepting responses",
        why: "Configured closeDate is in the past",
        fix: "Contact the form owner if you believe this is a mistake",
        internal: { formId: data.formId, closeDate: vSettings.closeDate },
      });
    }
    if (vSettings.limitSubmissions && vSettings.maxSubmissions) {
      // Count only completed rows toward the cap; incomplete drafts mustn't exhaust quota.
      const [{ value: submissionCount }] = await db
        .select({ value: count() })
        .from(submissions)
        .where(and(eq(submissions.formId, data.formId), eq(submissions.isCompleted, true)));
      if (submissionCount >= vSettings.maxSubmissions) {
        throw createError({
          code: "forms/closed" satisfies ErrorCode,
          status: 403,
          message: "This form has reached its maximum number of submissions",
          why: "Completed-submission count is at the configured maxSubmissions cap",
          fix: "Contact the form owner if you believe this is a mistake",
          internal: {
            formId: data.formId,
            submissionCount,
            maxSubmissions: vSettings.maxSubmissions,
          },
        });
      }
    }

    // Shape-only sanitize for drafts: strip keys not on published form.
    let sanitizedData = data.data;
    if (!data.isCompleted && version?.content) {
      const allowed = getAllowedFieldNames(form.lastPublishedVersionId, version.content as Value);
      if (allowed && allowed.size > 0) {
        sanitizedData = Object.fromEntries(
          Object.entries(data.data).filter(([k]) => allowed.has(k)),
        );
      }
    }

    // Completed submits: authoritative conditional-logic pass. Re-run the engine against the
    // published content + submitted answers, strip answers for server-hidden fields, then
    // validate the visible set against the effective-required schema. Don't trust the client.
    if (data.isCompleted && version?.content) {
      const publishedContent = version.content as Value;
      const { data: cleaned } = sanitizeSubmission(publishedContent, data.data);
      const result = v.safeParse(buildVisibleSchema(publishedContent, data.data), cleaned);
      if (!result.success) {
        throw createError({
          code: "submissions/invalid" satisfies ErrorCode,
          status: 400,
          message: "Submission failed validation",
          why: "Submitted answers don't satisfy the published form's visible/required fields",
          fix: "Complete all required visible fields and resubmit",
          internal: { issueCount: result.issues.length },
        });
      }

      // Verify-email gate: every visible "Verify email" field with a value must carry a
      // verified token matching that exact email + form. Don't trust the client UI.
      const verifyFields = getEditableFields(
        transformPlateStateToFormElements(publishedContent),
      ).filter((f) => f.fieldType === "Email" && f.verifyEmail === true);
      for (const field of verifyFields) {
        const value = cleaned[field.name];
        if (typeof value !== "string" || value.trim() === "") continue; // hidden/empty → skip
        const token = data.emailVerification?.[field.name];
        if (!token || !isEmailVerifiedToken(token, value, data.formId)) {
          throw createError({
            code: "submissions/email-not-verified" satisfies ErrorCode,
            status: 400,
            message: "Email address has not been verified",
            why: "A Verify-email field was submitted without a valid verification token",
            fix: "Complete the email verification step before submitting",
            internal: { fieldName: field.name },
          });
        }
      }

      sanitizedData = cleaned;
    }

    const now = new Date();
    let submissionId: string;
    // Prior completed state of the (formId, draftId) row, if it already existed. Drives the
    // no-downgrade noop and the once-only finalize/notification logic below.
    let wasCompleted = false;

    if (data.draftId) {
      const result = await upsertSubmissionByDraft({
        formId: data.formId,
        draftId: data.draftId,
        formVersionId: form.lastPublishedVersionId,
        data: sanitizedData,
        isCompleted: data.isCompleted,
        lastStepReached: data.lastStepReached ?? null,
        now,
      });
      submissionId = result.submissionId;
      wasCompleted = result.wasCompleted;
    } else {
      submissionId = crypto.randomUUID();
      await db.insert(submissions).values({
        id: submissionId,
        formId: data.formId,
        formVersionId: form.lastPublishedVersionId,
        data: sanitizedData,
        isCompleted: data.isCompleted,
        draftId: null,
        lastStepReached: data.lastStepReached ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Defense in depth: never downgrade completed → incomplete on out-of-order debounced save.
    // The upsert's CASE guard already left the stored row untouched; just short-circuit here.
    if (wasCompleted && !data.isCompleted) {
      return { submissionId, success: true, noop: true };
    }

    // Notifications + emails only fire on final submit, not on each draft save.
    const isFinalizing = data.isCompleted && !wasCompleted;
    if (isFinalizing) {
      // creator may be NULL after user delete (FK SET NULL).
      if (form.createdByUserId) {
        recordOwnerSubmissionNotification({
          formId: data.formId,
          userId: form.createdByUserId,
          submissionId,
          createdAt: now,
        }).catch(() => {});

        // waitUntil keeps the function alive until the send settles (response returns
        // immediately) instead of an orphan promise killed mid-send on Vercel.
        waitUntil(
          sendEmailNotifications(
            {
              selfEmailNotifications: vSettings.selfEmailNotifications ?? false,
              notificationEmail: vSettings.notificationEmail ?? null,
              // Pro-only — defense in depth for the post-downgrade webhook race.
              respondentEmailNotifications:
                (vSettings.respondentEmailNotifications ?? false) &&
                isServerPlan(form.orgPlan) &&
                planUnlocks(form.orgPlan, "respondentEmailNotifications"),
              respondentEmailSubject: vSettings.respondentEmailSubject ?? null,
              respondentEmailBody: vSettings.respondentEmailBody ?? null,
            },
            form.createdByUserId,
            data.formId,
            submissionId,
            sanitizedData,
          ).catch((err) => log.error({ tag: "Email", msg: "Notification error", error: err })),
        );
      }

      // Attribute submission to its visit row. draftId may span multiple visits across
      // sessions; current tab's visitId wins (most-recent-session attribution for v1).
      if (data.visitId) {
        // durationMs computed in SQL (no extra read). EXTRACT(EPOCH) is seconds → ×1000 = ms.
        db.update(formVisits)
          .set({
            didSubmit: true,
            didStartForm: true,
            submissionId,
            visitEndedAt: now,
            // ISO string, not Date: postgres-js won't auto-serialize a Date bound as a raw
            // sql`...` param (drizzle's column-aware Date→ISO mapping doesn't apply here).
            durationMs: sql`(EXTRACT(EPOCH FROM (${now.toISOString()}::timestamptz - ${formVisits.visitStartedAt})) * 1000)::int`,
            updatedAt: now,
          })
          .where(eq(formVisits.id, data.visitId))
          .catch(() => {
            /* visit may have been bot-rejected or pruned; non-fatal */
          });
      }
    }

    return { submissionId, success: true };
  });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Find respondent email in submission data: "email"-keyed first, then any email-like value. */
const findRespondentEmail = (data: Record<string, unknown>): string | null => {
  for (const [key, value] of Object.entries(data)) {
    if (key.toLowerCase().includes("email") && typeof value === "string" && value.includes("@")) {
      return value;
    }
  }
  for (const value of Object.values(data)) {
    if (typeof value === "string" && EMAIL_REGEX.test(value)) {
      return value;
    }
  }
  return null;
};

interface EmailNotificationSettings {
  selfEmailNotifications: boolean;
  notificationEmail: string | null;
  respondentEmailNotifications: boolean;
  respondentEmailSubject: string | null;
  respondentEmailBody: string | null;
}

/**
 * Send email notifications after form submission (fire-and-forget).
 */
const sendEmailNotifications = async (
  settings: EmailNotificationSettings,
  createdByUserId: string,
  formId: string,
  submissionId: string,
  submissionData: Record<string, unknown>,
) => {
  if (settings.selfEmailNotifications) {
    let toEmail = settings.notificationEmail;

    // Fallback to form owner's email
    if (!toEmail) {
      const [owner] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, createdByUserId));
      toEmail = owner?.email ?? null;
    }

    if (toEmail) {
      const [formRow] = await db
        .select({ title: forms.title })
        .from(forms)
        .where(eq(forms.id, formId));
      sendFormSubmissionNotification(
        toEmail,
        formRow?.title ?? "Untitled Form",
        submissionId,
        submissionData,
      ).catch((err) => log.error({ tag: "Email", msg: "Self notification error", error: err }));
    }
  }

  if (settings.respondentEmailNotifications) {
    const respondentEmail = findRespondentEmail(submissionData);
    if (respondentEmail) {
      const subject = settings.respondentEmailSubject || "Thank you for your submission";
      const body =
        settings.respondentEmailBody ||
        "Thank you for filling out our form. We have received your response.";
      sendRespondentConfirmation(respondentEmail, subject, body).catch((err) =>
        log.error({ tag: "Email", msg: "Respondent notification error", error: err }),
      );
    }
  }
};
