import { createServerFn } from "@tanstack/react-start";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
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
import { isServerPlan } from "./plan-helpers";
import { recordOwnerSubmissionNotification } from "./notifications-helpers.server";

type VersionSettings = {
  closeForm?: boolean;
  closeOnDate?: boolean;
  closeDate?: string | null;
  limitSubmissions?: boolean;
  maxSubmissions?: number | null;
  selfEmailNotifications?: boolean;
  notificationEmail?: string | null;
  respondentEmailNotifications?: boolean;
  respondentEmailSubject?: string | null;
  respondentEmailBody?: string | null;
};

// Max size of the `data` JSON payload in bytes for draft saves. Prevents
// malicious clients from stuffing arbitrary blobs into anonymous public rows.
const MAX_DRAFT_PAYLOAD_BYTES = 100_000;
// Min interval between draft upserts per draftId. Independent of the client
// debounce — defends against a runaway/malicious client.
const DRAFT_RATE_LIMIT_MS = 900;

// In-memory per-process rate-limit map. Good enough for a single-node deploy;
// swap for Redis/edge KV if we scale horizontally. Bounded via opportunistic
// eviction in the handler to prevent unbounded growth across many draftIds.
const draftLastWriteAt = new Map<string, number>();
const DRAFT_RATE_LIMIT_TTL_MS = DRAFT_RATE_LIMIT_MS * 20;
const DRAFT_RATE_LIMIT_MAX_ENTRIES = 10_000;

// Per-published-version cache of allowed field names. Version content is
// immutable per id, so the transform only needs to run once per version.
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
 * Public submission endpoint (no authentication).
 *
 * Two modes (Submission states — see CONTEXT.md):
 *   - **Incomplete**: `isCompleted: false` + `draftId`. Upserts on (formId, draftId).
 *     Shape-only validation (unknown fields rejected, types coerced), no
 *     required/format checks. Rate-limited per draftId. The `draftId` is a
 *     client-generated identifier for the autosave session — not a state label.
 *   - **Completed**: `isCompleted: true`. Full validation via published schema.
 *     If an incomplete row exists for the same (formId, draftId), it's updated in
 *     place. Refuses to downgrade an already-completed row.
 *
 * Gating + email settings are read from the published Form Version snapshot so
 * the Form's unpublished changes don't take effect until the user republishes.
 */
export const createPublicSubmission = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      formId: z.uuid(),
      data: z.record(z.string(), z.any()),
      isCompleted: z.boolean().default(true),
      draftId: z.uuid().optional(),
      lastStepReached: z.number().int().min(0).optional(),
      visitId: z.uuid().nullish(),
    }),
  )
  .handler(async ({ data }) => {
    // Payload size guard for incomplete submissions. Completed submits trust
    // the published schema to reject unreasonable payloads via field validators.
    if (!data.isCompleted) {
      const payloadSize = JSON.stringify(data.data).length;
      if (payloadSize > MAX_DRAFT_PAYLOAD_BYTES) {
        throw new Error("Draft payload too large");
      }
      if (!data.draftId) {
        throw new Error("draftId is required for partial submissions");
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
      throw new Error("Form not found");
    }

    if (form.status !== "published") {
      throw new Error("Form is not accepting submissions");
    }

    const [version] = form.lastPublishedVersionId
      ? await db
          .select({ settings: formVersions.settings, content: formVersions.content })
          .from(formVersions)
          .where(eq(formVersions.id, form.lastPublishedVersionId))
      : [undefined];

    const vSettings = (version?.settings ?? {}) as VersionSettings;

    // --- Server-side gating (prevent client-side bypass) ---
    if (vSettings.closeForm) {
      throw new Error("This form is closed");
    }
    if (
      vSettings.closeOnDate &&
      vSettings.closeDate &&
      new Date(vSettings.closeDate) < new Date()
    ) {
      throw new Error("This form is no longer accepting responses");
    }
    if (vSettings.limitSubmissions && vSettings.maxSubmissions) {
      // Only count completed rows toward the submission cap — incomplete ones shouldn't
      // exhaust the quota of a form with e.g. maxSubmissions = 100.
      const [{ value: submissionCount }] = await db
        .select({ value: count() })
        .from(submissions)
        .where(and(eq(submissions.formId, data.formId), eq(submissions.isCompleted, true)));
      if (submissionCount >= vSettings.maxSubmissions) {
        throw new Error("This form has reached its maximum number of submissions");
      }
    }

    // Shape-only sanitization for drafts only — strips keys that don't belong
    // to the published form. Final submits already enforce shape via the
    // client-side Zod schema, so we skip the transform on the hot path.
    let sanitizedData = data.data;
    if (!data.isCompleted && version?.content) {
      const allowed = getAllowedFieldNames(form.lastPublishedVersionId, version.content as Value);
      if (allowed && allowed.size > 0) {
        sanitizedData = Object.fromEntries(
          Object.entries(data.data).filter(([k]) => allowed.has(k)),
        );
      }
    }

    const existing = data.draftId
      ? await db
          .select({
            id: submissions.id,
            isCompleted: submissions.isCompleted,
          })
          .from(submissions)
          .where(and(eq(submissions.formId, data.formId), eq(submissions.draftId, data.draftId)))
          .limit(1)
      : [];
    const existingRow = existing[0];

    // Defense in depth: never downgrade a completed row back to incomplete, even if
    // an out-of-order debounced save arrives after submit.
    if (existingRow?.isCompleted && !data.isCompleted) {
      return { submissionId: existingRow.id, success: true, noop: true };
    }

    const now = new Date();
    let submissionId: string;

    if (existingRow) {
      submissionId = existingRow.id;
      await db
        .update(submissions)
        .set({
          data: sanitizedData,
          isCompleted: data.isCompleted,
          lastStepReached: data.lastStepReached ?? null,
          updatedAt: now,
          formVersionId: form.lastPublishedVersionId,
        })
        .where(eq(submissions.id, existingRow.id));
    } else {
      submissionId = crypto.randomUUID();
      await db.insert(submissions).values({
        id: submissionId,
        formId: data.formId,
        formVersionId: form.lastPublishedVersionId,
        data: sanitizedData,
        isCompleted: data.isCompleted,
        draftId: data.draftId ?? null,
        lastStepReached: data.lastStepReached ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Notifications + emails only fire on final submit, not on each draft save.
    const isFinalizing = data.isCompleted && (!existingRow || !existingRow.isCompleted);
    if (isFinalizing) {
      recordOwnerSubmissionNotification({
        formId: data.formId,
        userId: form.createdByUserId,
        submissionId,
        createdAt: now,
      }).catch(() => {});

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
      ).catch((err) => console.error("[Email] Notification error:", err));

      // Attribute the submission to its visit row. For incomplete → completed flows,
      // the same draftId may have produced multiple visits across sessions; the
      // current tab's visitId wins (most-recent-session attribution for v1).
      if (data.visitId) {
        // Compute durationMs in SQL so we don't need a separate read.
        // EXTRACT(EPOCH FROM ...) returns seconds, multiply by 1000 for ms.
        db.update(formVisits)
          .set({
            didSubmit: true,
            didStartForm: true,
            submissionId,
            visitEndedAt: now,
            // ISO string instead of Date — postgres-js doesn't auto-serialize
            // a Date when it's bound as a raw `sql\`...\`` template parameter
            // (drizzle's column-aware Date→ISO mapping doesn't apply here).
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

/**
 * Fetch an in-progress draft for a given (formId, draftId) pair so the client
 * can rehydrate the form on refresh. Returns null if no draft exists or the
 * row is already completed (completed rows are not resumable).
 */
export const getPublicDraft = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      formId: z.uuid(),
      draftId: z.uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const [row] = await db
      .select({
        id: submissions.id,
        data: submissions.data,
        isCompleted: submissions.isCompleted,
        lastStepReached: submissions.lastStepReached,
      })
      .from(submissions)
      .where(and(eq(submissions.formId, data.formId), eq(submissions.draftId, data.draftId)))
      .limit(1);

    if (!row || row.isCompleted) return { draft: null };
    return {
      draft: {
        submissionId: row.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- passed through as opaque JSON
        data: row.data as Record<string, any>,
        lastStepReached: row.lastStepReached,
      },
    };
  });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Find a respondent's email from submission data.
 * Priority: keys containing "email" first, then any email-like string value.
 */
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
  const { sendFormSubmissionNotification, sendRespondentConfirmation } =
    await import("@/integrations/email");

  // Self email notification
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
      ).catch((err) => console.error("[Email] Self notification error:", err));
    }
  }

  // Respondent email notification
  if (settings.respondentEmailNotifications) {
    const respondentEmail = findRespondentEmail(submissionData);
    if (respondentEmail) {
      const subject = settings.respondentEmailSubject || "Thank you for your submission";
      const body =
        settings.respondentEmailBody ||
        "Thank you for filling out our form. We have received your response.";
      sendRespondentConfirmation(respondentEmail, subject, body).catch((err) =>
        console.error("[Email] Respondent notification error:", err),
      );
    }
  }
};
