CREATE TABLE "form_notification_preferences" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"formId" text NOT NULL,
	"inAppNotifications" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submission_notifications" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"formId" text NOT NULL,
	"unreadCount" integer DEFAULT 0 NOT NULL,
	"isRead" boolean DEFAULT true NOT NULL,
	"firstUnreadAt" timestamp with time zone,
	"latestSubmissionAt" timestamp with time zone DEFAULT now() NOT NULL,
	"latestSubmissionId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_form_notification_preferences_user_id" ON "form_notification_preferences" ("userId");--> statement-breakpoint
CREATE INDEX "idx_form_notification_preferences_user_id_form_id" ON "form_notification_preferences" ("userId","formId");--> statement-breakpoint
CREATE INDEX "idx_form_submission_notifications_user_id" ON "form_submission_notifications" ("userId");--> statement-breakpoint
CREATE INDEX "idx_form_submission_notifications_user_id_form_id" ON "form_submission_notifications" ("userId","formId");--> statement-breakpoint
CREATE INDEX "idx_form_submission_notifications_user_id_is_read" ON "form_submission_notifications" ("userId","isRead");--> statement-breakpoint
ALTER TABLE "form_notification_preferences" ADD CONSTRAINT "form_notification_preferences_formId_forms_id_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_submission_notifications" ADD CONSTRAINT "form_submission_notifications_formId_forms_id_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE;--> statement-breakpoint
INSERT INTO "form_notification_preferences" ("id", "userId", "formId", "inAppNotifications", "createdAt", "updatedAt")
SELECT
	"createdByUserId" || ':' || "id",
	"createdByUserId",
	"id",
	true,
	now(),
	now()
FROM "forms"
WHERE "selfEmailNotifications" = true;
