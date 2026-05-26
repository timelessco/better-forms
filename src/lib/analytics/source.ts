/**
 * Resolve a visit's traffic source for the Sources breakdown.
 *
 * Priority: an explicit `utm_source` tag wins; otherwise we attribute from the
 * referrer (web domain or Android in-app package). Loopback/dev hosts and a
 * missing referrer resolve to "direct". Pure + isomorphic so the aggregation
 * cron and the read path agree.
 */

interface SourceInput {
  utmSource?: string | null;
  referrer?: string | null;
}

// Exact host (minus a leading "www.") OR Android in-app package → canonical token.
const SOURCE_BY_HOST: Record<string, string> = {
  // Web hosts
  "twitter.com": "twitter",
  "x.com": "twitter",
  "t.co": "twitter",
  "facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "l.facebook.com": "facebook",
  "lm.facebook.com": "facebook",
  "fb.com": "facebook",
  "fb.me": "facebook",
  "linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  "instagram.com": "instagram",
  "l.instagram.com": "instagram",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "reddit.com": "reddit",
  "out.reddit.com": "reddit",
  "github.com": "github",
  "slack.com": "slack",
  "app.slack.com": "slack",
  "t.me": "telegram",
  "pinterest.com": "pinterest",
  "producthunt.com": "producthunt",
  "news.ycombinator.com": "hackernews",
  // Android in-app referrers (android-app://<package>)
  "com.slack": "slack",
  "com.twitter.android": "twitter",
  "com.linkedin.android": "linkedin",
  "com.google.android.gm": "gmail",
  "com.google.android.googlequicksearchbox": "google",
  "com.google.android.youtube": "youtube",
  "com.facebook.katana": "facebook",
  "com.facebook.orca": "facebook",
  "com.instagram.android": "instagram",
  "com.whatsapp": "whatsapp",
  "com.reddit.frontpage": "reddit",
  "org.telegram.messenger": "telegram",
};

// Search engines span many ccTLDs (google.co.in, …) — match by host prefix.
const SEARCH_PREFIXES: readonly [string, string][] = [
  ["google.", "google"],
  ["bing.", "bing"],
  ["yahoo.", "yahoo"],
  ["yandex.", "yandex"],
  ["duckduckgo.", "duckduckgo"],
  ["ecosia.", "ecosia"],
  ["baidu.", "baidu"],
];

// Loopback / dev hosts are the form owner's own machine, not a real source.
const SELF_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
const ANDROID_APP_PREFIX = "android-app://";
const WWW_PREFIX_RE = /^www\./;

const isSelfHost = (host: string): boolean => SELF_HOSTS.has(host) || host.endsWith(".localhost");

/** Normalized hostname (lowercased, no leading "www."), or null if unparseable. */
const referrerHost = (referrer: string): string | null => {
  try {
    return new URL(referrer).hostname.toLowerCase().replace(WWW_PREFIX_RE, "");
  } catch {
    return null;
  }
};

const matchSearchEngine = (host: string): string | null => {
  for (const [prefix, source] of SEARCH_PREFIXES) {
    if (host.startsWith(prefix)) {
      return source;
    }
  }
  return null;
};

export const resolveSource = ({ utmSource, referrer }: SourceInput): string => {
  const utm = utmSource?.trim();
  if (utm) {
    return utm;
  }
  if (!referrer) {
    return "direct";
  }
  // Android in-app referrers carry the app's package id as the "host".
  if (referrer.startsWith(ANDROID_APP_PREFIX)) {
    const pkg = referrer.slice(ANDROID_APP_PREFIX.length).split("/")[0]?.toLowerCase() ?? "";
    if (!pkg) {
      return "direct";
    }
    return SOURCE_BY_HOST[pkg] ?? pkg;
  }
  const host = referrerHost(referrer);
  if (!host || isSelfHost(host)) {
    return "direct";
  }
  return SOURCE_BY_HOST[host] ?? matchSearchEngine(host) ?? host;
};
