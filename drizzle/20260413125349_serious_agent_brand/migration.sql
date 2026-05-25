CREATE TABLE "custom_domains" (
	"id" text PRIMARY KEY,
	"organizationId" text NOT NULL,
	"domain" text NOT NULL UNIQUE,
	"status" text DEFAULT 'pending' NOT NULL,
	"vercelDomainId" text,
	"siteTitle" text,
	"faviconUrl" text,
	"ogImageUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "customDomainId" text;--> statement-breakpoint
CREATE INDEX "custom_domains_org_idx" ON "custom_domains" ("organizationId");--> statement-breakpoint
CREATE INDEX "custom_domains_domain_idx" ON "custom_domains" ("domain");--> statement-breakpoint
CREATE INDEX "idx_forms_slug_custom_domain" ON "forms" ("slug","customDomainId");