import { createFileRoute } from "@tanstack/react-router";
import { publicCorsHeaders } from "@/lib/config/embed-cors";
// Bundle sprite contents into the server function. Vercel's serverless runtime
// does not expose `public/` on the function filesystem, so reading by path
// fails at runtime. `?raw` inlines the file as a string at build time.
import spriteSvg from "../../../../public/sprite.svg?raw";

const CORS_HEADERS = {
  ...publicCorsHeaders,
  "Cache-Control": "public, max-age=86400, immutable",
  "Content-Type": "image/svg+xml; charset=utf-8",
};

// Validate up-front so no user input ever flows into the RegExp constructor.
const NAME_RE = /^[a-z0-9-]{1,64}$/i;

// Bound the symbol cache so an attacker scanning names can't grow it
// indefinitely. 2× the real icon count is more than enough headroom.
const MAX_CACHE_SIZE = 1024;

const symbolCache = new Map<string, string>();

// Defensive scrub: even though sprite.svg is a trusted build artifact, strip
// any <script> elements and on* event handlers before caching. If someone ever
// rewires this SVG into a context that executes scripts (e.g. innerHTML or
// <object>), we stay safe.
const sanitizeSvgFragment = (fragment: string): string =>
  fragment
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");

const extractSymbol = (sprite: string, name: string): string | null => {
  const cached = symbolCache.get(name);
  if (cached) return cached;
  const re = new RegExp(`<symbol[^>]*\\bid="${name}"[^>]*>([\\s\\S]*?)</symbol>`, "i");
  const match = sprite.match(re);
  if (!match) return null;
  const inner = sanitizeSvgFragment(match[1]);
  // Dual-purpose output: the outer <svg> renders directly (e.g. via <img>),
  // and the inner <symbol> is addressable via `#${name}` for external
  // `<use href="/api/icons/${name}.svg#${name}">`. `fill="currentColor"` must
  // live on the <symbol> itself — outer <svg> attributes don't cascade across
  // a cross-document `<use>` reference, so without it the icon paints blank.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><symbol id="${name}" viewBox="0 0 24 24" fill="currentColor">${inner}</symbol><use href="#${name}" fill="currentColor"/></svg>`;
  if (symbolCache.size >= MAX_CACHE_SIZE) symbolCache.clear();
  symbolCache.set(name, svg);
  return svg;
};

export const Route = createFileRoute("/api/icons/$name")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ params }: { params: { name: string } }) => {
        const name = params.name.replace(/\.svg$/i, "");
        if (!NAME_RE.test(name)) {
          return new Response("invalid name", { status: 400, headers: CORS_HEADERS });
        }
        try {
          const svg = extractSymbol(spriteSvg, name);
          if (!svg) {
            return new Response("not found", { status: 404, headers: CORS_HEADERS });
          }
          return new Response(svg, { status: 200, headers: CORS_HEADERS });
        } catch {
          return new Response("error", { status: 500, headers: CORS_HEADERS });
        }
      },
    },
  },
});
