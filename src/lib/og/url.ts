import { APP_WEBSITE_URL } from "@/lib/config/app-config";
import { computeOgHash } from "@/lib/og/hash";

export type BuildOgImageUrlInput = {
  shortId: string;
  title: string;
  description: string;
};

/** Absolute content-addressed OG image URL. Always at APP_WEBSITE_URL (crawlers
 * fetch it regardless of which domain served the HTML). Hash changes iff
 * title/description does — unchanged republish keeps the URL + edge cache. */
export const buildOgImageUrl = ({ shortId, title, description }: BuildOgImageUrlInput): string => {
  const hash = computeOgHash({ title, description });
  return `${APP_WEBSITE_URL}/api/og/${shortId}/${hash}.png`;
};
