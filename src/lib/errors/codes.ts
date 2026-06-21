// Stable machine-readable error codes. Client branches on `parseError().code`,
// not message strings; `createError` picks from this union (TS catches typos).
// Convention: `domain/kebab`, lowercase. Shipped codes are public API —
// rename = breaking change.
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
  | "submissions/invalid"
  | "submissions/email-not-verified" // verifyEmail field submitted without a valid verification token

  // --- Email OTP (public-form "Verify email") ---------------------------
  | "otp/rate-limited"
  | "otp/not-applicable" // form has no verify-email field — refuse to send
  | "otp/invalid-code"
  | "otp/expired"

  // --- Notifications ---------------------------------------------------
  | "notifications/forbidden"

  // --- AI quota / generation ------------------------------------------
  | "quota/ai-daily-limit"
  | "quota/ai-rate-limited" // per-org short-window burst limit on AI form-generate

  // --- Vercel infrastructure (custom-domains via Vercel API) ----------
  // Wrap upstream Vercel SDK failures; status mirrors upstream, else 502.
  | "vercel/domain-add-failed"
  | "vercel/domain-check-failed"
  | "vercel/domain-verify-failed"
  | "vercel/domain-detach-failed"
  | "vercel/domain-delete-failed"

  // --- Internal / fallback ---------------------------------------------
  | "internal/unexpected";
