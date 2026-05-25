CREATE TABLE "user_workspace_order" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"workspaceId" text NOT NULL,
	"sortIndex" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_favorites" ADD COLUMN "sortIndex" text;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "sortIndex" text;--> statement-breakpoint
CREATE INDEX "idx_forms_workspace_id_sort_index" ON "forms" ("workspaceId","sortIndex");--> statement-breakpoint
CREATE INDEX "idx_user_workspace_order_user_id" ON "user_workspace_order" ("userId");