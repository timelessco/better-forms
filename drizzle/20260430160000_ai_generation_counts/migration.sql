CREATE TABLE "ai_generation_counts" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"period_day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "ai_generation_counts"
	ADD CONSTRAINT "ai_generation_counts_organization_id_organization_id_fkey"
	FOREIGN KEY ("organization_id")
	REFERENCES "organization"("id")
	ON DELETE CASCADE;

CREATE INDEX "idx_ai_generation_counts_org_day"
	ON "ai_generation_counts" ("organization_id", "period_day");
