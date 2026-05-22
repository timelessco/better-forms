-- Add visual asset columns to form version snapshots so icon/cover can be
-- read from the version row (previously public endpoint read from live forms row).
-- Idempotent: an earlier migration (20260416093601_aromatic_bedlam) also adds
-- these columns. Keeping the duplicate ADD COLUMNs so the migration's intent
-- stays self-documenting, but guarding with IF NOT EXISTS so replays don't
-- fail when both migrations land on a fresh database.
ALTER TABLE "form_versions" ADD COLUMN IF NOT EXISTS "icon" text;--> statement-breakpoint
ALTER TABLE "form_versions" ADD COLUMN IF NOT EXISTS "cover" text;--> statement-breakpoint

-- Backfill: for every form that has a published version, copy the current
-- forms.icon/cover into that form's last published version snapshot so the
-- public endpoint can immediately read from the version without a fallback.
UPDATE "form_versions" fv
SET "icon" = f."icon", "cover" = f."cover"
FROM "forms" f
WHERE f."lastPublishedVersionId" = fv."id";--> statement-breakpoint

-- Backfill: existing version.settings rows may be empty objects because the
-- old publishFormVersion wrote `form.settings` jsonb (unused) instead of the
-- flat columns. Rebuild version.settings from the live forms.* columns for
-- each form's last published version so Group 2 fields survive the switch.
UPDATE "form_versions" fv
SET "settings" = jsonb_build_object(
  'progressBar', f."progressBar",
  'branding', f."branding",
  'autoJump', f."autoJump",
  'saveAnswersForLater', f."saveAnswersForLater",
  'redirectOnCompletion', f."redirectOnCompletion",
  'redirectUrl', f."redirectUrl",
  'redirectDelay', f."redirectDelay",
  'language', f."language",
  'passwordProtect', f."passwordProtect",
  'password', f."password",
  'closeForm', f."closeForm",
  'closedFormMessage', f."closedFormMessage",
  'closeOnDate', f."closeOnDate",
  'closeDate', f."closeDate",
  'limitSubmissions', f."limitSubmissions",
  'maxSubmissions', f."maxSubmissions",
  'preventDuplicateSubmissions', f."preventDuplicateSubmissions",
  'selfEmailNotifications', f."selfEmailNotifications",
  'notificationEmail', f."notificationEmail",
  'respondentEmailNotifications', f."respondentEmailNotifications",
  'respondentEmailSubject', f."respondentEmailSubject",
  'respondentEmailBody', f."respondentEmailBody",
  'dataRetention', f."dataRetention",
  'dataRetentionDays', f."dataRetentionDays"
)
FROM "forms" f
WHERE f."lastPublishedVersionId" = fv."id";
