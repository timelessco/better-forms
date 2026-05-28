-- AI Chat Presentation Mode foundation
-- See docs/plans/2026-04-27-ai-chat-presentation-mode.md
-- See docs/adr/0001-ai-chat-stateless-rpc.md

-- 1. Per-Submission marker table. One row per Incomplete Submission ensures
--    resuming a Chat Session does not re-count against the Org-Month cap.
--    Cap check is `COUNT(*) WHERE org=$1 AND period_month=$2`.
CREATE TABLE "ai_chat_sessions" (
	"submission_id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"period_month" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "ai_chat_sessions"
	ADD CONSTRAINT "ai_chat_sessions_organization_id_organization_id_fkey"
	FOREIGN KEY ("organization_id")
	REFERENCES "organization"("id")
	ON DELETE CASCADE;

CREATE INDEX "idx_ai_chat_sessions_org_month"
	ON "ai_chat_sessions" ("organization_id", "period_month");

-- 2. Per-Org-Day builder-preview counter (same shape as ai_generation_counts).
CREATE TABLE "ai_chat_preview_counts" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"period_day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "ai_chat_preview_counts"
	ADD CONSTRAINT "ai_chat_preview_counts_organization_id_organization_id_fkey"
	FOREIGN KEY ("organization_id")
	REFERENCES "organization"("id")
	ON DELETE CASCADE;

CREATE INDEX "idx_ai_chat_preview_counts_org_day"
	ON "ai_chat_preview_counts" ("organization_id", "period_day");

-- 3. Per-IP token-bucket rate limit for /api/ai/chat-form.
CREATE TABLE "ai_chat_rate_limits" (
	"ip" text PRIMARY KEY,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);

-- 4. Update form_settings.settings JSON default to include the two new keys.
--    Existing rows are NOT backfilled — `buildPublicFormSettings` falls back
--    to the TS default for missing keys, so old rows keep working.
ALTER TABLE "form_settings"
	ALTER COLUMN "settings" SET DEFAULT '{
		"language":"English",
		"redirectOnCompletion":false,
		"redirectUrl":null,
		"redirectDelay":0,
		"progressBar":false,
		"presentationMode":"card",
		"aiChatTone":"friendly",
		"aiChatGreeting":null,
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
	}'::jsonb;
