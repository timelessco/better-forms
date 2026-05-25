import { APP_NAME, APP_WEBSITE_URL } from "@/lib/config/app-config";

const DEFAULT_DESCRIPTION =
  "A modern form builder application that lets you create, customize, and share beautiful forms with a rich text editor experience. Built with a real-time local-first architecture for instant responsiveness.";
const DEFAULT_KEYWORDS =
  "form builder, online forms, survey builder, react forms, tanstack, reform";
const DEFAULT_IMAGE = `${APP_WEBSITE_URL}/metadata/og.png`;
const TWITTER_HANDLE = "@vijayabaskar56";

type SeoInput = {
  title?: string;
  description?: string;
  image?: string;
  formTitle?: string;
  siteTitle?: string;
  noindex?: boolean;
};

export const seo = ({
  title,
  description,
  image,
  formTitle,
  siteTitle = APP_NAME,
  noindex = false,
}: SeoInput = {}) => {
  const resolvedTitle = title ?? (formTitle ? `${formTitle} | ${siteTitle}` : siteTitle);
  const resolvedDescription =
    description ?? (formTitle ? `Fill out ${formTitle}` : DEFAULT_DESCRIPTION);
  const resolvedImage = image || DEFAULT_IMAGE;

  const tags: Array<Record<string, string>> = [
    { title: resolvedTitle },
    { name: "description", content: resolvedDescription },
    { name: "keywords", content: DEFAULT_KEYWORDS },
    { name: "twitter:title", content: resolvedTitle },
    { name: "twitter:description", content: resolvedDescription },
    { name: "twitter:creator", content: TWITTER_HANDLE },
    { name: "twitter:site", content: TWITTER_HANDLE },
    { name: "twitter:url", content: APP_WEBSITE_URL },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: resolvedImage },
    { property: "og:type", content: "website" },
    { property: "og:title", content: resolvedTitle },
    { property: "og:description", content: resolvedDescription },
    { property: "og:url", content: APP_WEBSITE_URL },
    { property: "og:site_name", content: APP_NAME },
    { property: "og:image", content: resolvedImage },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
  ];

  if (noindex) tags.push({ name: "robots", content: "noindex, nofollow" });

  return tags;
};
