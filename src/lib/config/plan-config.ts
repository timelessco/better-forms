export const PLAN_PRODUCT_IDS = {
  free: "398f06f7-a6f6-4f65-80b6-62e38bd2825c",
  pro: "3662224a-d998-4a73-bf82-4957198d53ea",
  business: "5a566057-f63c-47f6-85ca-82cabf324057",
} as const;

export const PRO_PRODUCT_IDS = [PLAN_PRODUCT_IDS.pro];
export const BUSINESS_PRODUCT_IDS = [PLAN_PRODUCT_IDS.business];

export type Plan = "free" | "pro" | "business";

/**
 * Map a Polar product id to its Plan tier. Used by the webhook handler
 * (server) and the user-plan hook (client) so the productId→plan logic has
 * one home and can't drift.
 */
export const planForProductId = (productId: string | null | undefined): Plan => {
  if (!productId) return "free";
  if ((BUSINESS_PRODUCT_IDS as readonly string[]).includes(productId)) return "business";
  if ((PRO_PRODUCT_IDS as readonly string[]).includes(productId)) return "pro";
  return "free";
};

// `maxDomainsPerOrg` is our product-level cap. Vercel's own project soft caps
// are separate: 100,000/project on Pro, 1,000,000 on Enterprise. If we ever
// approach those (e.g., aggregating across all tenants), request a raise via
// Vercel support — see https://vercel.com/docs/multi-tenant/limits.
export const DOMAIN_LIMITS = {
  maxDomainsPerOrg: 5,
} as const;

export const RESERVED_SLUGS = new Set([
  "f",
  "api",
  "health",
  "login",
  "forms",
  "settings",
  "_authenticated",
  "workspace",
  "accept-invite",
]);
