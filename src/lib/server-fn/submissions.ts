import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import * as v from "valibot";
import type { Value } from "platejs";
import { formSettings, forms, formVersions, submissions } from "@/db/schema";
import type { SubmissionRow } from "@/db/schema";
import { db } from "@/db";
import {
  getEditableFields,
  transformPlateStateToFormElements,
} from "@/lib/editor/transform-plate-to-form";
import { authMiddleware } from "@/lib/auth/middleware";
import { purgeFormCache } from "@/lib/server-fn/cdn-cache";
import { requireScopedForm } from "./auth-helpers.server";

export type SerializedSubmission = {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  isCompleted: boolean;
  lastStepReached: number | null;
  createdAt: string;
  updatedAt: string;
};

const serializeSubmission = (s: SubmissionRow) => ({
  ...s,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
  data: s.data as Record<string, object>,
});

// Purge CDN iff a delete could re-open the limit-reached gate (published AND limitSubmissions on).
// Cheap fire-and-forget; over-purges when count far from cap, but cost is one Vercel API call.
const maybePurgeAfterSubmissionDelete = async (formId: string) => {
  // Read LIVE settings: only published limitSubmissions matters for the public gate, not draft.
  const [row] = await db
    .select({
      lastPublishedVersionId: forms.lastPublishedVersionId,
      settings: formSettings.settings,
    })
    .from(forms)
    .leftJoin(formSettings, eq(formSettings.formId, forms.id))
    .where(eq(forms.id, formId));
  if (row?.lastPublishedVersionId && row.settings?.limitSubmissions) {
    await purgeFormCache(formId);
  }
};

export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    v.object({ id: v.pipe(v.string(), v.uuid()), formId: v.pipe(v.string(), v.uuid()) }),
  )
  .handler(async ({ data, context }) => {
    await requireScopedForm(context.session, data.formId);
    await db.delete(submissions).where(eq(submissions.id, data.id));
    await maybePurgeAfterSubmissionDelete(data.formId);
    return { success: true };
  });

export const deleteSubmissionsBulk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    v.object({
      formId: v.pipe(v.string(), v.uuid()),
      submissionIds: v.array(v.pipe(v.string(), v.uuid())),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireScopedForm(context.session, data.formId);
    if (data.submissionIds.length === 0) {
      return { success: true, deleted: 0 };
    }
    await db.delete(submissions).where(inArray(submissions.id, data.submissionIds));
    await maybePurgeAfterSubmissionDelete(data.formId);
    return { success: true, deleted: data.submissionIds.length };
  });

export type SubmissionCursor = { createdAt: string; id: string };
export const SUBMISSIONS_PAGE_SIZE = 50;

export const getSubmissionsByFormIdPaginated = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(
    v.object({
      formId: v.pipe(v.string(), v.uuid()),
      cursor: v.optional(v.object({ createdAt: v.string(), id: v.string() })),
      limit: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
        SUBMISSIONS_PAGE_SIZE,
      ),
      search: v.optional(v.string()),
    }),
  )
  .handler(async ({ data, context }) => {
    const { formId, cursor, limit, search } = data;

    await requireScopedForm(context.session, formId);

    const cursorCondition = cursor
      ? or(
          lt(submissions.createdAt, new Date(cursor.createdAt)),
          and(eq(submissions.createdAt, new Date(cursor.createdAt)), lt(submissions.id, cursor.id)),
        )
      : undefined;

    const searchCondition = search?.trim()
      ? sql`${submissions.data}::text ILIKE ${"%" + search.trim() + "%"}`
      : undefined;

    const conditions = [eq(submissions.formId, formId), cursorCondition, searchCondition].filter(
      Boolean,
    );

    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

    const rows = await db
      .select()
      .from(submissions)
      .where(whereCondition)
      .orderBy(desc(submissions.createdAt), desc(submissions.id))
      .limit(limit + 1);
    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
    const lastRow = pageRows.at(-1);

    const nextCursor: SubmissionCursor | undefined =
      hasNextPage && lastRow
        ? {
            createdAt: lastRow.createdAt.toISOString(),
            id: lastRow.id,
          }
        : undefined;

    return {
      submissions: pageRows.map(serializeSubmission),
      nextCursor,
    };
  });

export const getSubmissionsCount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(v.object({ formId: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data, context }) => {
    await requireScopedForm(context.session, data.formId);

    const [result] = await db
      .select({ total: count() })
      .from(submissions)
      .where(eq(submissions.formId, data.formId));

    return { total: result?.total ?? 0 };
  });

/** Bootstrap for submissions page: published form content, total count, name→label map across ALL
 * historical versions. One round-trip replacing three queries; no orphan-detection waterfall. */
export const getSubmissionsBootstrap = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(v.object({ formId: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data, context }) => {
    await requireScopedForm(context.session, data.formId);

    const [publishedRow, countRow, allVersions] = await Promise.all([
      db
        .select({
          id: forms.id,
          status: forms.status,
          lastPublishedVersionId: forms.lastPublishedVersionId,
          versionTitle: formVersions.title,
          versionContent: formVersions.content,
          versionSettings: formVersions.settings,
          versionCustomization: formVersions.customization,
          versionIcon: formVersions.icon,
          versionCover: formVersions.cover,
        })
        .from(forms)
        .leftJoin(formVersions, eq(forms.lastPublishedVersionId, formVersions.id))
        .where(and(eq(forms.id, data.formId), eq(forms.status, "published")))
        .then((rows) => rows[0]),
      db
        .select({ total: count() })
        .from(submissions)
        .where(eq(submissions.formId, data.formId))
        .then((rows) => rows[0]),
      db
        .select({ content: formVersions.content })
        .from(formVersions)
        .where(eq(formVersions.formId, data.formId))
        .orderBy(desc(formVersions.version)),
    ]);

    // Resolve labels across every historical version. Newest version wins on conflict.
    const fieldLabels: Record<string, string> = {};
    for (const v of allVersions) {
      const elements = transformPlateStateToFormElements(v.content as Value);
      for (const field of getEditableFields(elements)) {
        if ("label" in field && field.label && !(field.name in fieldLabels)) {
          fieldLabels[field.name] = field.label;
        }
      }
    }

    const form =
      publishedRow && publishedRow.lastPublishedVersionId && publishedRow.versionContent
        ? {
            id: publishedRow.id,
            title: publishedRow.versionTitle ?? "",
            content: publishedRow.versionContent as object[],
            settings: publishedRow.versionSettings,
            customization: (publishedRow.versionCustomization ?? {}) as Record<string, string>,
            icon: publishedRow.versionIcon,
            cover: publishedRow.versionCover,
            status: publishedRow.status,
          }
        : null;

    return {
      form,
      totalCount: countRow?.total ?? 0,
      fieldLabels,
    };
  });
