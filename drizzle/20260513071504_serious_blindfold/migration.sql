ALTER TABLE "form_versions" ADD COLUMN IF NOT EXISTS "publishedByName" text;--> statement-breakpoint
ALTER TABLE "form_versions" ADD COLUMN IF NOT EXISTS "publishedByImage" text;--> statement-breakpoint

-- forms.shortId — 7-char base62 public identifier. Add nullable, backfill,
-- then enforce NOT NULL + UNIQUE. See docs/adr/0001-form-short-ids.md.
ALTER TABLE "forms" ADD COLUMN "shortId" text;--> statement-breakpoint

-- One-shot backfill. Picks a 7-char base62 string per row using random();
-- ongoing inserts use nanoid CSPRNG via the application code. random() is
-- adequate here because the namespace is 62^7 ≈ 3.5T and the unique check
-- below loops on the rare collision.
DO $$
DECLARE
  alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  r record;
  new_id text;
  attempt int;
BEGIN
  FOR r IN SELECT id FROM "forms" WHERE "shortId" IS NULL LOOP
    attempt := 0;
    LOOP
      new_id := '';
      FOR i IN 1..7 LOOP
        new_id := new_id || substr(alphabet, 1 + floor(random() * 62)::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "forms" WHERE "shortId" = new_id);
      attempt := attempt + 1;
      IF attempt > 5 THEN
        RAISE EXCEPTION 'failed to allocate unique shortId after 5 attempts for forms.id=%', r.id;
      END IF;
    END LOOP;
    UPDATE "forms" SET "shortId" = new_id WHERE id = r.id;
  END LOOP;
END $$;--> statement-breakpoint

ALTER TABLE "forms" ALTER COLUMN "shortId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_shortId_key" UNIQUE("shortId");
