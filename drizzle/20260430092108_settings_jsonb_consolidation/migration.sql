-- Add settings JSONB column with empty default. Existing rows get '{}'.
ALTER TABLE "forms" ADD COLUMN "settings" jsonb NOT NULL DEFAULT '{}';

-- Backfill: project the 25 inlined behavioral columns into the new JSONB.
-- jsonb_strip_nulls keeps the JSON tidy; null fields fall back to defaults
-- via the FormSettings type at the application layer.
UPDATE "forms"
SET "settings" = jsonb_strip_nulls(
  jsonb_build_object(
    'language', "language",
    'redirectOnCompletion', "redirectOnCompletion",
    'redirectUrl', "redirectUrl",
    'redirectDelay', "redirectDelay",
    'progressBar', "progressBar",
    'branding', "branding",
    'analytics', "analytics",
    'saveAnswersForLater', "saveAnswersForLater",
    'presentationMode', "presentationMode",
    'selfEmailNotifications', "selfEmailNotifications",
    'notificationEmail', "notificationEmail",
    'respondentEmailNotifications', "respondentEmailNotifications",
    'respondentEmailSubject', "respondentEmailSubject",
    'respondentEmailBody', "respondentEmailBody",
    'passwordProtect', "passwordProtect",
    'password', "password",
    'closeForm', "closeForm",
    'closedFormMessage', "closedFormMessage",
    'closeOnDate', "closeOnDate",
    'closeDate', "closeDate",
    'limitSubmissions', "limitSubmissions",
    'maxSubmissions', "maxSubmissions",
    'preventDuplicateSubmissions', "preventDuplicateSubmissions",
    'dataRetention', "dataRetention",
    'dataRetentionDays', "dataRetentionDays"
  )
);

-- Drop the now-redundant inlined columns.
ALTER TABLE "forms" DROP COLUMN "language";
ALTER TABLE "forms" DROP COLUMN "redirectOnCompletion";
ALTER TABLE "forms" DROP COLUMN "redirectUrl";
ALTER TABLE "forms" DROP COLUMN "redirectDelay";
ALTER TABLE "forms" DROP COLUMN "progressBar";
ALTER TABLE "forms" DROP COLUMN "branding";
ALTER TABLE "forms" DROP COLUMN "analytics";
ALTER TABLE "forms" DROP COLUMN "saveAnswersForLater";
ALTER TABLE "forms" DROP COLUMN "presentationMode";
ALTER TABLE "forms" DROP COLUMN "selfEmailNotifications";
ALTER TABLE "forms" DROP COLUMN "notificationEmail";
ALTER TABLE "forms" DROP COLUMN "respondentEmailNotifications";
ALTER TABLE "forms" DROP COLUMN "respondentEmailSubject";
ALTER TABLE "forms" DROP COLUMN "respondentEmailBody";
ALTER TABLE "forms" DROP COLUMN "passwordProtect";
ALTER TABLE "forms" DROP COLUMN "password";
ALTER TABLE "forms" DROP COLUMN "closeForm";
ALTER TABLE "forms" DROP COLUMN "closedFormMessage";
ALTER TABLE "forms" DROP COLUMN "closeOnDate";
ALTER TABLE "forms" DROP COLUMN "closeDate";
ALTER TABLE "forms" DROP COLUMN "limitSubmissions";
ALTER TABLE "forms" DROP COLUMN "maxSubmissions";
ALTER TABLE "forms" DROP COLUMN "preventDuplicateSubmissions";
ALTER TABLE "forms" DROP COLUMN "dataRetention";
ALTER TABLE "forms" DROP COLUMN "dataRetentionDays";
