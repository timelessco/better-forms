import "@tanstack/react-start/server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Module-scope db helper — kept in a .server file so it never reaches the client bundle.
// public-submissions.ts is imported by client code (autosave hook, public form page); a plain
// exported db user there would drag the postgres driver into the browser build.

interface UpsertSubmissionArgs {
  formId: string;
  draftId: string;
  formVersionId: string | null;
  data: unknown;
  isCompleted: boolean;
  lastStepReached: number | null;
  now: Date;
}

/**
 * Atomic upsert keyed on the partial unique index uniq_submissions_form_id_draft_id
 * (formId, draftId WHERE draftId IS NOT NULL). Replaces a read-then-write that let two
 * concurrent submits both INSERT → unique violation → spurious 500. A CTE captures the
 * pre-write isCompleted (RETURNING only exposes the new row), so callers can still derive the
 * no-downgrade noop and once-only finalize. The CASE no-downgrade guard keeps a completed row
 * completed when a late debounced save arrives with isCompleted=false. Returns the resolved
 * submission id and whether the row was already completed before this write.
 */
export const upsertSubmissionByDraft = async (
  args: UpsertSubmissionArgs,
): Promise<{ submissionId: string; wasCompleted: boolean }> => {
  const newId = crypto.randomUUID();
  const sanitizedJson = JSON.stringify(args.data);
  const nowIso = args.now.toISOString();
  const rows = await db.execute<{
    id: string;
    priorIsCompleted: boolean | null;
  }>(sql`
    WITH prior AS (
      SELECT "id", "isCompleted"
      FROM "submissions"
      WHERE "formId" = ${args.formId} AND "draftId" = ${args.draftId}
    ),
    up AS (
      INSERT INTO "submissions"
        ("id", "formId", "formVersionId", "data", "isCompleted", "draftId",
         "lastStepReached", "createdAt", "updatedAt")
      VALUES
        (${newId}, ${args.formId}, ${args.formVersionId}, ${sanitizedJson}::jsonb,
         ${args.isCompleted}, ${args.draftId}, ${args.lastStepReached},
         ${nowIso}::timestamptz, ${nowIso}::timestamptz)
      ON CONFLICT ("formId", "draftId") WHERE "draftId" IS NOT NULL
      DO UPDATE SET
        "data" = CASE
          WHEN "submissions"."isCompleted" = true AND excluded."isCompleted" = false
            THEN "submissions"."data"
          ELSE excluded."data"
        END,
        "isCompleted" = CASE
          WHEN "submissions"."isCompleted" = true AND excluded."isCompleted" = false
            THEN "submissions"."isCompleted"
          ELSE excluded."isCompleted"
        END,
        "lastStepReached" = CASE
          WHEN "submissions"."isCompleted" = true AND excluded."isCompleted" = false
            THEN "submissions"."lastStepReached"
          ELSE excluded."lastStepReached"
        END,
        "formVersionId" = CASE
          WHEN "submissions"."isCompleted" = true AND excluded."isCompleted" = false
            THEN "submissions"."formVersionId"
          ELSE excluded."formVersionId"
        END,
        "updatedAt" = CASE
          WHEN "submissions"."isCompleted" = true AND excluded."isCompleted" = false
            THEN "submissions"."updatedAt"
          ELSE excluded."updatedAt"
        END
      RETURNING "id"
    )
    SELECT up."id" AS "id", prior."isCompleted" AS "priorIsCompleted"
    FROM up
    LEFT JOIN prior ON prior."id" = up."id"
  `);
  const row = rows[0];
  return {
    submissionId: row?.id ?? newId,
    wasCompleted: row?.priorIsCompleted === true,
  };
};
