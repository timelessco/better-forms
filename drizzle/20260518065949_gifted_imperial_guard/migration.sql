ALTER TABLE "form_dropoff_daily" ADD COLUMN "stepId" text;--> statement-breakpoint
ALTER TABLE "form_dropoff_daily" ADD COLUMN "stepIndex" integer;--> statement-breakpoint
ALTER TABLE "form_dropoff_daily" ADD COLUMN "terminalDropoffCount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "form_question_progress" ADD COLUMN "stepId" text;--> statement-breakpoint
ALTER TABLE "form_question_progress" ADD COLUMN "stepIndex" integer;--> statement-breakpoint
-- Dedupe duplicate (visitId, questionId) rows produced by the pre-rework race
-- condition (analytics.server.ts:146-149) so the unique index can be created.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY "visitId", "questionId"
           ORDER BY "completedAt" DESC NULLS LAST,
                    "startedAt"  DESC NULLS LAST,
                    "viewedAt"   DESC,
                    id
         ) AS rn
  FROM form_question_progress
)
DELETE FROM form_question_progress
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_form_question_progress_visit_question" ON "form_question_progress" ("visitId","questionId");