-- Rename the Plan tier literal from "biz" to "business" so the DB enum
-- matches the user-facing label end-to-end. Business Plan is being launched
-- with Polar product id 5a566057-f63c-47f6-85ca-82cabf324057.
UPDATE "organization" SET "plan" = 'business' WHERE "plan" = 'biz';
