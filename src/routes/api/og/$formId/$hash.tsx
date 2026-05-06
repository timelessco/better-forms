import { createFileRoute } from "@tanstack/react-router";
import { ImageResponse } from "@vercel/og";
import { and, eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { formVersions, forms } from "@/db/schema";
import { FORM_ID_RE } from "@/lib/config/embed-cors";
import { computeOgHash } from "@/lib/og/hash";
import { resolveOgInputs } from "@/lib/og/resolve-inputs";
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

        const og = resolveOgInputs(version, {
          title: form.draftTitle,
          content: form.draftContent,
          icon: form.draftIcon,
          customization: form.draftCustomization as Record<string, string> | null,
        });

        const expected = computeOgHash({ title: og.title, description: og.description });
        if (expected !== hashParam) {
          return new Response("hash_mismatch", { status: 404, headers: NOT_FOUND_HEADERS });
        }

        const fontData = await loadFont();

        return new ImageResponse(
          <OgCard
            description={og.description}
            icon={og.icon}
            themeColorName={og.themeColorName}
            title={og.title}
          />,
          {
            width: 1200,
            height: 630,
            fonts: [
              { name: "Inter", data: fontData, weight: 400, style: "normal" },
              { name: "Inter", data: fontData, weight: 700, style: "normal" },
            ],
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
