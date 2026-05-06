import { createFileRoute } from "@tanstack/react-router";
import { ImageResponse } from "@vercel/og";
import { and, eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { formVersions, forms } from "@/db/schema";
import { FORM_ID_RE } from "@/lib/config/embed-cors";
import { extractOgDescription } from "@/lib/og/extract-description";
import { computeOgHash } from "@/lib/og/hash";
import { OgCard } from "@/lib/og/template";
import { formCacheTag } from "@/lib/server-fn/cdn-cache";

const FONT_PATH = path.join(
  process.cwd(),
  "public/fonts/inter-variable/fonts/inter-variable-latin.woff2",
);

let cachedFont: ArrayBuffer | null = null;
const loadFont = async (): Promise<ArrayBuffer> => {
  if (cachedFont) return cachedFont;
  const buf = await readFile(FONT_PATH);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  cachedFont = ab;
  return ab;
};

const NOT_FOUND_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=60",
  "Content-Type": "text/plain",
};

const HASH_RE = /^[A-Za-z0-9_-]{10}$/;
const PNG_SUFFIX = ".png";

export const Route = createFileRoute("/api/og/$formId/$hash")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { formId: string; hash: string } }) => {
        const hashParam = params.hash.endsWith(PNG_SUFFIX)
          ? params.hash.slice(0, -PNG_SUFFIX.length)
          : params.hash;

        if (!FORM_ID_RE.test(params.formId) || !HASH_RE.test(hashParam)) {
          return new Response("invalid", { status: 400, headers: NOT_FOUND_HEADERS });
        }

        const [form] = await db
          .select({
            id: forms.id,
            status: forms.status,
            lastPublishedVersionId: forms.lastPublishedVersionId,
            draftTitle: forms.title,
            draftContent: forms.content,
            draftIcon: forms.icon,
            draftCustomization: forms.customization,
          })
          .from(forms)
          .where(and(eq(forms.id, params.formId), eq(forms.status, "published")));

        if (!form) {
          return new Response("not_found", { status: 404, headers: NOT_FOUND_HEADERS });
        }

        const [version] = form.lastPublishedVersionId
          ? await db
              .select({
                title: formVersions.title,
                content: formVersions.content,
                icon: formVersions.icon,
                customization: formVersions.customization,
              })
              .from(formVersions)
              .where(eq(formVersions.id, form.lastPublishedVersionId))
          : [undefined];

        const title = version?.title ?? form.draftTitle ?? "Untitled";
        const content = version?.content ?? form.draftContent;
        const icon = (version?.icon ?? form.draftIcon) || null;
        const customization = (version?.customization ?? form.draftCustomization) as
          | Record<string, string>
          | null
          | undefined;
        const themeColorName = customization?.themeColor ?? null;

        const description = extractOgDescription(content);

        const expected = computeOgHash({ title, description });
        if (expected !== hashParam) {
          return new Response("hash_mismatch", { status: 404, headers: NOT_FOUND_HEADERS });
        }

        const fontData = await loadFont();

        return new ImageResponse(
          <OgCard
            description={description}
            icon={icon}
            themeColorName={themeColorName}
            title={title}
          />,
          {
            width: 1200,
            height: 630,
            fonts: [{ name: "Inter", data: fontData, weight: 400, style: "normal" }],
            headers: {
              "Cache-Control": "public, max-age=31536000, immutable",
              "Cache-Tag": formCacheTag(params.formId),
            },
          },
        );
      },
    },
  },
});
