ALTER TABLE "submissions" ADD COLUMN "draftId" text;
ALTER TABLE "submissions" ADD COLUMN "lastStepReached" integer;
CREATE UNIQUE INDEX "uniq_submissions_form_id_draft_id" ON "submissions" ("formId", "draftId") WHERE "draftId" IS NOT NULL;
