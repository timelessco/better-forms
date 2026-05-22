// Canonical list of stable, machine-readable error codes used across the
// app. Client code branches on these via `parseError(err).code` rather
// than parsing user-facing message strings. Server `createError({ code,
// ... })` calls must pick from this union so TypeScript catches typos.
//
// Convention: `domain/kebab-specific`. Lowercase. Stable — once a code
// ships, treat it like a public API: rename = breaking change for any
// client that branches on it.
export type ErrorCode =
  // --- Auth & access ----------------------------------------------------
  | "auth/no-org" // no active organization on the session
  | "auth/forbidden" // generic 403 — not the owner / wrong role
  | "auth/not-workspace-member" // user is not a member of this workspace
  | "auth/not-form-owner" // form exists but caller doesn't own it

  // --- Forms ------------------------------------------------------------
  | "forms/not-found"
  | "forms/slug-taken"
  | "forms/slug-reserved"
  | "forms/slug-invalid-length"
  | "forms/slug-invalid-format" // slug doesn't match [a-z0-9-] pattern
  | "forms/closed" // form not accepting submissions (closed/expired/etc.)
  | "forms/short-id-collision" // ran out of attempts allocating a unique shortId

  // --- Form versions ----------------------------------------------------
  | "versions/not-found"
  | "versions/no-published" // can't revert — nothing published

  // --- Workspaces -------------------------------------------------------
  | "workspaces/not-found"
  | "workspaces/cannot-delete-last"

  // --- Custom domains ---------------------------------------------------
  | "domains/not-found"
  | "domains/not-owner" // only org owner can manage
  | "domains/not-belongs-to-org"
  | "domains/limit-reached"
  | "domains/not-verified"
  | "domains/pro-required" // custom domains require Pro plan
  | "domains/invalid-host" // host must be a subdomain (no apex/bare)
  | "domains/not-authorized" // generic membership-required for domain reads

  // --- Plan / billing gates --------------------------------------------
  | "plan/pro-required" // generic pro-only feature gate
  | "billing/no-customer" // no Polar customer for this account
  | "billing/forbidden"

  // --- Uploads ----------------------------------------------------------
  | "uploads/rate-limited"
  | "uploads/mime-not-allowed"
  | "uploads/empty-file"
  | "uploads/too-large"
  | "uploads/form-no-content"
  | "uploads/field-not-found"

  // --- Public submissions ----------------------------------------------
  | "submissions/draft-too-large"
  | "submissions/missing-draft-id"

  // --- Notifications ---------------------------------------------------
  | "notifications/forbidden"

  // --- AI quota / generation ------------------------------------------
  | "quota/ai-daily-limit"

  // --- Vercel infrastructure (custom-domains via Vercel API) ----------
  // These wrap upstream Vercel SDK failures; status mirrors the upstream
  // HTTP response when available, falls back to 502 for opaque failures.
  | "vercel/domain-add-failed"
  | "vercel/domain-check-failed"
  | "vercel/domain-verify-failed"
  | "vercel/domain-detach-failed"
  | "vercel/domain-delete-failed"

  // --- Internal / fallback ---------------------------------------------
  | "internal/unexpected";
