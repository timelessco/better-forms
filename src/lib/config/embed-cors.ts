/** CORS for public embed endpoints — expose non-sensitive published-form data to
 * any site so public/embed/popup.js can render. NO Allow-Credentials: must never
 * be hit with cookies. */
export const publicCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;
