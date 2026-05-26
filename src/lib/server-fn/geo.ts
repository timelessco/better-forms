import { createServerFn } from "@tanstack/react-start";

/**
 * The visitor's ISO-3166 alpha-2 country code from Vercel's edge geo header
 * (`x-vercel-ip-country`), or `null` when unavailable — local dev, a
 * non-Vercel runtime, or an anonymizing proxy.
 *
 * Used to default the phone-number country to the Respondent's actual
 * location instead of their browser UI language. `navigator.language` is
 * frequently `en-US` for non-US users, which would mis-default the country
 * to +1 and reformat e.g. an Indian number as a US one.
 *
 * `getRequestHeaders` is imported lazily inside the handler so the
 * server-only `@tanstack/react-start/server` entry never reaches the client
 * bundle (the handler body is stripped client-side).
 */
export const getVisitorCountry = createServerFn({ method: "GET" }).handler(
  async (): Promise<string | null> => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    return getRequestHeaders().get("x-vercel-ip-country");
  },
);
