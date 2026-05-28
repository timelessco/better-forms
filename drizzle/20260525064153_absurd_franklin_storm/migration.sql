CREATE TABLE "ai_chat_preview_counts" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"period_day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_rate_limits" (
	"ip" text PRIMARY KEY,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_sessions" (
	"submission_id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"period_month" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_settings" ALTER COLUMN "settings" SET DEFAULT '{"language":"English","redirectOnCompletion":false,"redirectUrl":null,"redirectDelay":0,"progressBar":false,"presentationMode":"card","aiChatTone":"friendly","aiChatGreeting":null,"branding":true,"analytics":false,"dataRetention":false,"dataRetentionDays":null,"selfEmailNotifications":false,"notificationEmail":null,"respondentEmailNotifications":false,"respondentEmailSubject":null,"respondentEmailBody":null,"passwordProtect":false,"password":null,"closeForm":false,"closedFormMessage":null,"closeOnDate":false,"closeDate":null,"limitSubmissions":false,"maxSubmissions":null,"preventDuplicateSubmissions":false,"saveAnswersForLater":true}';--> statement-breakpoint
ALTER TABLE "forms" ALTER COLUMN "draftSettings" SET DEFAULT '{"language":"English","redirectOnCompletion":false,"redirectUrl":null,"redirectDelay":0,"progressBar":false,"presentationMode":"card","aiChatTone":"friendly","aiChatGreeting":null,"branding":true,"analytics":false,"dataRetention":false,"dataRetentionDays":null,"selfEmailNotifications":false,"notificationEmail":null,"respondentEmailNotifications":false,"respondentEmailSubject":null,"respondentEmailBody":null,"passwordProtect":false,"password":null,"closeForm":false,"closedFormMessage":null,"closeOnDate":false,"closeDate":null,"limitSubmissions":false,"maxSubmissions":null,"preventDuplicateSubmissions":false,"saveAnswersForLater":true}';--> statement-breakpoint
CREATE INDEX "idx_ai_chat_preview_counts_org_day" ON "ai_chat_preview_counts" ("organization_id","period_day");--> statement-breakpoint
CREATE INDEX "idx_ai_chat_sessions_org_month" ON "ai_chat_sessions" ("organization_id","period_month");--> statement-breakpoint
ALTER TABLE "ai_chat_preview_counts" ADD CONSTRAINT "ai_chat_preview_counts_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;