ALTER TABLE "organization" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;
ALTER TABLE "custom_domains" ADD COLUMN "previousStatus" text;
