-- Split settings out of version history
-- See docs/plans/2026-05-04-settings-version-split.md

-- 1. Rename forms.settings → forms.draft_settings (working buffer)
ALTER TABLE "forms" RENAME COLUMN "settings" TO "draft_settings";

-- 2. Make form_versions.settings nullable. Settings are no longer versioned;
--    new version rows write null. Legacy rows keep their pre-split snapshot
--    so historical reads still parse, but nothing currently consumes it.
ALTER TABLE "form_versions" ALTER COLUMN "settings" DROP NOT NULL;

-- 3. New form_settings table — live published settings, one row per form.
CREATE TABLE "form_settings" (
	"form_id" text PRIMARY KEY,
	"settings" jsonb NOT NULL DEFAULT '{
		"language":"English",
		"redirectOnCompletion":false,
		"redirectUrl":null,
		"redirectDelay":0,
		"progressBar":false,
		"presentationMode":"card",
		"branding":true,
		"analytics":false,
		"dataRetention":false,
		"dataRetentionDays":null,
		"selfEmailNotifications":false,
		"notificationEmail":null,
		"respondentEmailNotifications":false,
		"respondentEmailSubject":null,
		"respondentEmailBody":null,
		"passwordProtect":false,
		"password":null,
		"closeForm":false,
		"closedFormMessage":null,
		"closeOnDate":false,
		"closeDate":null,
		"limitSubmissions":false,
		"maxSubmissions":null,
		"preventDuplicateSubmissions":false,
		"saveAnswersForLater":true
	}'::jsonb,
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "form_settings"
	ADD CONSTRAINT "form_settings_form_id_forms_id_fkey"
	FOREIGN KEY ("form_id")
	REFERENCES "forms"("id")
	ON DELETE CASCADE;

-- 4. Backfill: every form that has been published gets a form_settings row
--    seeded from its current draft_settings. Forms that have never been
--    published don't get a row — first publish click will create one.
INSERT INTO "form_settings" ("form_id", "settings", "updated_at")
SELECT "id", "draft_settings", now()
FROM "forms"
WHERE "last_published_version_id" IS NOT NULL
ON CONFLICT ("form_id") DO NOTHING;
