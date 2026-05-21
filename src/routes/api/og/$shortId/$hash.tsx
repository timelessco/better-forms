import { createFileRoute } from "@tanstack/react-router";
import { ImageResponse } from "@vercel/og";
import { and, eq } from "drizzle-orm";
// `?raw` inlines the sprite at build time so the function bundle on Vercel
// (where /var/task has no public/) can extract <symbol> bodies for OG icons.
import spriteSvg from "../../../../../public/sprite.svg?raw";
import { db } from "@/db";
import { formVersions, forms } from "@/db/schema";
import { computeOgHash } from "@/lib/og/hash";
import { isValidShortId } from "@/lib/short-id";
import { resolveOgInputs } from "@/lib/og/resolve-inputs";
import { buildIconDataUrl, isIconUrl, isSpriteIconName } from "@/lib/og/sprite-icon";
import { OgCard } from "@/lib/og/template";
import { formCacheTag } from "@/lib/server-fn/cdn-cache";

// Light icon fill against the dark card background.
const ICON_FILL = "#fafafa";

const NOT_FOUND_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=60",
  "Content-Type": "text/plain",
};

// Short TTL on errors so a transient failure doesn't poison the edge cache for
// a year (the success path uses `immutable, max-age=31536000`).
const ERROR_HEADERS = {
  "Cache-Control": "public, max-age=30, s-maxage=30",
  "Content-Type": "text/plain",
};

const HASH_RE = /^[A-Za-z0-9_-]{10}$/;
const PNG_SUFFIX = ".png";

export const Route = createFileRoute("/api/og/$shortId/$hash")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { shortId: string; hash: string } }) => {
        const hashParam = params.hash.endsWith(PNG_SUFFIX)
          ? params.hash.slice(0, -PNG_SUFFIX.length)
          : params.hash;

        if (!isValidShortId(params.shortId) || !HASH_RE.test(hashParam)) {
          return new Response("invalid", { status: 400, headers: NOT_FOUND_HEADERS });
        }

        // eslint-disable-next-line react-doctor/async-defer-await -- the awaited form record IS the data for the immediately-following 404 guard
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
          .where(and(eq(forms.shortId, params.shortId), eq(forms.status, "published")));

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

        // Resolve the form's icon to something Satori can rasterize via <img>.
        // Sprite names (e.g. "fingerprint-03") are extracted from the bundled
        // sprite into a data URL; uploaded images come through as absolute URLs;
        // anything else falls back to the `f.` brand mark inside OgCard.
        let iconUrl: string | null = null;
        if (isIconUrl(og.icon)) {
          iconUrl = og.icon;
        } else if (og.icon && isSpriteIconName(og.icon)) {
          iconUrl = buildIconDataUrl(spriteSvg, og.icon, ICON_FILL);
        }

        // Buffer the streaming PNG so render errors surface here instead of
        // silently truncating the body to 0 bytes (which the edge then caches
        // as `immutable` for a year).
        try {
          const image = new ImageResponse(
            <OgCard
              description={og.description}
              iconUrl={iconUrl}
              themeColorName={og.themeColorName}
              title={og.title}
            />,
            { width: 1200, height: 630 },
          );
          const body = await image.arrayBuffer();
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=31536000, immutable",
              "Cache-Tag": formCacheTag(form.id),
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(`og_render_failed: ${message}`, {
            status: 500,
            headers: ERROR_HEADERS,
          });
        }
      },
    },
  },
});
