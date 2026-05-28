/**
 * Best-effort IANA timezone → ISO-3166 alpha-2 country resolution.
 *
 * Used as a *synchronous, client-side, location-based* first-paint guess for
 * the phone-number country (e.g. seeding the country selector + placeholder)
 * before the authoritative geo-IP lookup resolves. Unlike `navigator.language`
 * — which reflects the UI language (often `en-US` for non-US users) — the
 * browser timezone tracks physical location, so an `en-US` browser in India
 * still resolves to `IN`.
 *
 * This is intentionally NOT exhaustive: it covers the common, high-traffic
 * zones. Unmapped zones return `undefined`, and the caller falls back to
 * geo-IP (authoritative) and then the browser locale. Geo-IP overrides this
 * guess once it arrives, so an imperfect map only affects the very first frame.
 */
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // South Asia
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Karachi": "PK",
  "Asia/Dhaka": "BD",
  "Asia/Colombo": "LK",
  "Asia/Kathmandu": "NP",
  // East / Southeast Asia
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Jakarta": "ID",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Manila": "PH",
  // Middle East
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Qatar": "QA",
  "Asia/Jerusalem": "IL",
  "Asia/Tehran": "IR",
  "Asia/Istanbul": "TR",
  "Europe/Istanbul": "TR",
  // Europe
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Lisbon": "PT",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Athens": "GR",
  "Europe/Bucharest": "RO",
  "Europe/Budapest": "HU",
  "Europe/Kyiv": "UA",
  "Europe/Kiev": "UA",
  "Europe/Moscow": "RU",
  // Africa
  "Africa/Cairo": "EG",
  "Africa/Lagos": "NG",
  "Africa/Johannesburg": "ZA",
  "Africa/Nairobi": "KE",
  "Africa/Casablanca": "MA",
  "Africa/Accra": "GH",
  // Oceania
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Pacific/Auckland": "NZ",
  // Americas
  "America/New_York": "US",
  "America/Detroit": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Mexico_City": "MX",
  "America/Bogota": "CO",
  "America/Lima": "PE",
  "America/Santiago": "CL",
  "America/Buenos_Aires": "AR",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Sao_Paulo": "BR",
};

/**
 * The visitor's country guessed from their browser timezone, or `undefined`
 * when the timezone is unknown/unmapped or the platform lacks `Intl`.
 */
export const getTimezoneCountry = (): string | undefined => {
  if (typeof Intl === "undefined") return undefined;
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone ? TIMEZONE_TO_COUNTRY[timeZone] : undefined;
  } catch {
    return undefined;
  }
};
