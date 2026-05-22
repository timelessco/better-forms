import { APP_WEBSITE_URL } from "@/lib/config/app-config";
import { computeOgHash } from "@/lib/og/hash";

export type BuildOgImageUrlInput = {
  shortId: string;
  title: string;
  description: string;
};

/**
 * Returns the absolute, content-addressed URL for a form's OG image.
 *
 * Always anchored at APP_WEBSITE_URL — share-card crawlers fetch this
 * URL regardless of which domain (central or custom) served the HTML.
 * The hash makes the URL change exactly when title or description does,
 * so an unchanged republish keeps the URL (and the edge cache hit) and
 * a content-changed republish rotates to a fresh URL.
 */
export const buildOgImageUrl = ({ shortId, title, description }: BuildOgImageUrlInput): string => {
  const hash = computeOgHash({ title, description });
  return `${APP_WEBSITE_URL}/api/og/${shortId}/${hash}.png`;
};
