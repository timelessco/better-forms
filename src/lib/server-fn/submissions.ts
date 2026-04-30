import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Value } from "platejs";
import { forms, formVersions, submissions } from "@/db/schema";
import { db } from "@/db";
import {
  getEditableFields,
  transformPlateStateToFormElements,
} from "@/lib/editor/transform-plate-to-form";
import { authMiddleware } from "@/lib/auth/middleware";
import { purgeFormCache } from "@/lib/server-fn/cdn-cache";
import { getActiveOrgId } from "./auth-helpers";
import { authForm } from "./auth-helpers.server";

export type SerializedSubmission = {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  isCompleted: boolean;
  lastStepReached: number | null;
  createdAt: string;
  updatedAt: string;
};

const serializeSubmission = (s: typeof submissions.$inferSelect) => ({
  ...s,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
  data: s.data as Record<string, object>,
});

// Purge the form's CDN cache iff a submission delete could have re-opened the
// limit-reached gate — i.e. the form was published AND has limitSubmissions
// turned on. Cheap fire-and-forget; over-purges in the "count was nowhere
// near the cap" case but cost is one Vercel API call.
const maybePurgeAfterSubmissionDelete = async (formId: string) => {
  const [row] = await db
    .select({
      lastPublishedVersionId: forms.lastPublishedVersionId,
      settings: forms.settings,
    })
    .from(forms)
    .where(eq(forms.id, formId));
  if (row?.lastPublishedVersionId && row.settings?.limitSubmissions) {
    void purgeFormCache(formId);
  }
};

export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.uuid(), formId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authForm(data.formId, context.session.user.id, orgId);
    await db.delete(submissions).where(eq(submissions.id, data.id));
    await maybePurgeAfterSubmissionDelete(data.formId);
    return { success: true };
  });

export const deleteSubmissionsBulk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      formId: z.uuid(),
      submissionIds: z.array(z.uuid()),
    }),
  )
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authForm(data.formId, context.session.user.id, orgId);
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
    z.object({
      formId: z.uuid(),
      cursor: z.object({ createdAt: z.string(), id: z.string() }).optional(),
      limit: z.number().int().min(1).max(100).default(SUBMISSIONS_PAGE_SIZE),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { formId, cursor, limit, search } = data;

    const orgId = getActiveOrgId(context.session);
    await authForm(formId, context.session.user.id, orgId);

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
  .inputValidator(z.object({ formId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authForm(data.formId, context.session.user.id, orgId);

    const [result] = await db
      .select({ total: count() })
      .from(submissions)
      .where(eq(submissions.formId, data.formId));

    return { total: result?.total ?? 0 };
  });

/**
 * Bootstrap data for the submissions page: published form content, total count,
 * and a complete name → label map across ALL historical versions.
 *
 * Replaces three separate queries (published version, count, historical labels)
 * with one round-trip and removes the orphan-detection waterfall.
 */
export const getSubmissionsBootstrap = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ formId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authForm(data.formId, context.session.user.id, orgId);

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
