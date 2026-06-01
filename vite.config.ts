import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import evlog from "evlog/vite";
import { nitro } from "nitro/vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import viteTsConfigPaths from "vite-tsconfig-paths";

// Custom Cache-Control headers for the public embed script so updates
// propagate quickly to embedders without requiring a versioned URL.
const setEmbedHeader = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => {
  if (req.url?.startsWith("/embed/popup.js") || req.url?.startsWith("/widgets/embed.js")) {
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
  }
  next();
};

const embedCacheHeadersPlugin = (): Plugin => ({
  name: "embed-cache-headers",
  configureServer(server) {
    server.middlewares.use(setEmbedHeader);
  },
  configurePreviewServer(server) {
    server.middlewares.use(setEmbedHeader);
  },
});

// The framework's static-asset middleware (in both Vite dev and preview)
// intercepts requests where the browser sends `Sec-Fetch-Dest: image` —
// it tries to serve a public/ file, finds nothing for `/api/icons/...`,
// and 404s before TanStack's `/api/icons/$name` route handler runs.
// Strip the header for /api/icons/ requests so the asset middleware
// skips them and TanStack gets a chance. Vercel routes /api/* directly
// to functions in production, so this only matters locally.
const stripImageSentinelForApiIcons = (
  req: IncomingMessage,
  _res: ServerResponse,
  next: (err?: unknown) => void,
) => {
  if (req.url?.startsWith("/api/icons/")) {
    delete req.headers["sec-fetch-dest"];
  }
  next();
};

const apiIconsDevBypass = (): Plugin => ({
  name: "api-icons-dev-bypass",
  configureServer(server) {
    server.middlewares.use(stripImageSentinelForApiIcons);
  },
  configurePreviewServer(server) {
    server.middlewares.use(stripImageSentinelForApiIcons);
  },
});

const config = defineConfig({
  plugins: [
    embedCacheHeadersPlugin(),
    apiIconsDevBypass(),
    devtools({
      editor: {
        name: "VSCode",
        open: async (path, lineNumber, columnNumber) => {
          const { exec } = await import("node:child_process");
          exec(
            `code -g "${path.replaceAll("$", "\\$")}${lineNumber ? `:${lineNumber}` : ""}${columnNumber ? `:${columnNumber}` : ""}"`,
          );
        },
      },
      // editor: {
      //   name: "Antigravity",
      //   open: async (path, lineNumber, columnNumber) => {
      //     const { exec } = await import("node:child_process");
      //     exec(
      //       `antigravity -g "${path.replaceAll("$", "\\$")}${lineNumber ? `:${lineNumber}` : ""}${columnNumber ? `:${columnNumber}` : ""}"`,
      //     );
      //   },
      // },
      enhancedLogs: {
        enabled: true,
      },
      logging: true,
      consolePiping: {
        enabled: true,
        levels: ["log", "warn", "error", "info", "debug"],
      },
    }),
    // Build-time evlog: injects service/env via Vite `define` so
    // `import { log } from "evlog"` works without a manual `initLogger()`,
    // strips `log.debug()` from production builds, and adds `__source:
    // 'file:line'` to object-form log calls in dev. `client: {...}` is
    // intentionally omitted — no browser-side transport endpoint yet.
    evlog({
      service: "reform",
      environment: process.env.NODE_ENV,
      sourceLocation: "dev",
      // Explicit prod gate: machine-readable JSON in production, pretty
      // colors in dev. Default already follows this, made explicit so a
      // future config audit doesn't have to guess.
      pretty: process.env.NODE_ENV !== "production",
    }),
    nitro({
      experimental: {
        asyncContext: true,
        typescriptBundlerResolution: true,
      },
      vercel: {
        functions: {
          maxDuration: 799,
          runtime: "nodejs22.x",
          supportsResponseStreaming: true,
          regions: ["bom1", "iad1", "fra1"],
        },
        config: {
          version: 3,
          crons: [
            { path: "/api/cron/aggregate-analytics", schedule: "15 0 * * *" },
            { path: "/api/cron/purge-archived-forms", schedule: "30 0 * * *" },
          ],
        },
      },
      routeRules: {
        "/embed/popup.js": {
          headers: {
            "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
            "Access-Control-Allow-Origin": "*",
          },
        },
        "/widgets/embed.js": {
          headers: {
            "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
            "Access-Control-Allow-Origin": "*",
          },
        },
      },
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
      router: {},
      rsc: {
        enabled: true,
      },
      // Inline CSS is now handled manually in `__root.tsx` via a
      // `styles.css?inline` import — that path emits exactly one inline
      // <style> and no <link>. The framework's `inlineCss: true` produced
      // BOTH an inline style AND a manifest-driven `<link rel="stylesheet">`
      // for the same content, so Lighthouse flagged the link as render-
      // blocking (~70 ms est savings). It also regressed mobile Perf by
      // bundling every CSS chunk in the manifest into one ~309 kB inline
      // block that triggered ~3s of synchronous style-recalc on 4× CPU
      // throttled mobile. The manual `?inline` path only emits styles.css
      // (Tailwind output), small enough to parse without a long task.
      server: {
        build: {
          inlineCss: false,
        },
      },
    }),
    rsc(),
    viteReact({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
    process.env.ANALYZE
      ? {
          ...analyzer({ analyzerMode: "static", openAnalyzer: true }),
          applyToEnvironment: (env) => env.name === "client",
        }
      : null,
  ],
  resolve: {
    // `jotai` added: @platejs/core pins ~2.8.4 while another tree pulls 2.20.0,
    // so node_modules has two copies. The Vite RSC plugin's client-references
    // grouping collides when both reach the bundler ("Identifier 'import_*'
    // has already been declared"). Deduping picks one for the bundle.
    dedupe: ["@platejs/core", "jotai"],
  },
  server: {
    sourcemapIgnoreList: (sourcePath) => sourcePath.includes("node_modules"),
  },
  build: {
    // Emit .vite/manifest.json so the server can resolve lazy field chunks
    // and emit <link rel="modulepreload"> for the fields used on step 1.
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Pin Vite's dynamic-import preload helper (`__vitePreload`) to its
          // own tiny chunk. Otherwise Rollup places it in `editor` (largest
          // shared chunk via platejs), which forces every module that uses
          // dynamic `import()` — fields, form-preview, public-form-page — to
          // pull `editor-*.js` (362 kB) and its KaTeX `editor-*.css` (7 kB)
          // just to call the helper.
          if (id.includes("vite/preload-helper")) return "vite-runtime";
          // Pin small shared runtime utilities to their own chunk so Rollup
          // can't absorb them into `editor`. Without this, `use-sync-external-store`
          // and `scheduler` end up owned by the editor chunk (because platejs
          // also uses them), which forces every Base UI primitive that needs
          // those utilities (e.g. `getDisabledMountTransitionStyles`, `useForm`,
          // `useDebouncedCallback`) to pull the full editor chunk + KaTeX CSS
          // on the public form's happy path. Also covers tiny class-name utilities
          // (`clsx`, `tailwind-merge`, `class-variance-authority`) that every `cn()`
          // caller would otherwise drag into whatever chunk Rollup picks first.
          if (id.includes("node_modules/use-sync-external-store")) return "shared-runtime";
          if (id.includes("node_modules/scheduler")) return "shared-runtime";
          if (
            id.includes("node_modules/clsx") ||
            id.includes("node_modules/tailwind-merge") ||
            id.includes("node_modules/class-variance-authority")
          )
            return "shared-runtime";
          if (id.includes("@platejs/") || id.includes("platejs")) return "editor";
          if (id.includes("@radix-ui/")) return "ui";
          // Pin Base UI primitives to their own chunk. Without this, modules
          // like `getDisabledMountTransitionStyles` / `useOpenInteractionType`
          // end up grouped with `editor` by Rollup's auto-chunker, which
          // forces every field chunk (InputField, TextareaField, …) that
          // uses a Base UI primitive to pull the full 361 kB platejs chunk
          // + KaTeX CSS.
          //
          // A per-primitive split (`ui-base-<primitive>` from a regex) was
          // tried in PR #86 and rolled back — it caused
          // `Cannot access 'React$1' before initialization` (TDZ violation)
          // in the SSR bundle on Vercel, crashing every request with 500.
          // Rollup splits @base-ui's internal cross-primitive deps in a way
          // that breaks ESM init order in the Nitro server bundle. Single-
          // bucket "ui" keeps all base-ui modules together, sidestepping
          // the cycle. Reintroducing per-primitive needs an actual Nitro
          // SSR smoke test (vite preview alone doesn't catch it).
          if (id.includes("@base-ui/")) return "ui";
          if (id.includes("@sentry/")) return "sentry";
        },
      },
    },
  },
  ssr: {
    noExternal: [/^@platejs\//, "platejs", "@udecode/utils", "katex", "react-tweet"],
    external: [
      "dexie",
      "tanstack-dexie-db-collection",
      "fsevents",
      "postgres",
      "drizzle-orm",
      "drizzle-orm/postgres-js",
      // Keep @vercel/og resolved from node_modules at runtime so the package's
      // sibling `Geist-Regular.ttf` (read at module load via
      // `new URL("./Geist-Regular.ttf", import.meta.url)`) ships intact into
      // the Vercel function. Inlining it into the SSR bundle drops the .ttf
      // and crashes with ENOENT on first import in /var/task/_ssr/.
      "@vercel/og",
      // @vercel/oidc (pulled in transitively by `ai@6` → `@ai-sdk/gateway`
      // → here for AI Gateway auth) ships CJS-only modules that crash Vite
      // 7's module runner with `Cannot read properties of undefined
      // (reading '__cjs_module_runner_transform')`. Hand it to Node's
      // native CJS loader at runtime. `@ai-sdk/gateway` itself is ESM and
      // must stay bundled so Rollup can resolve it.
      "@vercel/oidc",
    ],
  },
  environments: {
    rsc: {
      resolve: {
        external: [
          "postgres",
          "drizzle-orm",
          "drizzle-orm/postgres-js",
          // Same rationale as `ssr.external` above — also applied to the RSC
          // env so the OG route's transitive imports stay un-bundled wherever
          // the route tree happens to be analyzed.
          "@vercel/og",
        ],
        // Inline platejs + its slate/utils deps so the re-export chain is
        // resolved at bundle time. Leaving them external lets Rollup guess
        // which sibling package a re-exported name came from (e.g. bindFirst
        // lives in @udecode/utils but gets guessed as @platejs/slate), and
        // the wrong guess breaks downstream consumers of the RSC output.
        //
        // Must mirror `ssr.noExternal`: any Plate plugin transitive dep left
        // external is loaded + transpiled by Bun at request time, which fails
        // on Vercel's read-only filesystem ("bun is unable to write files").
        // katex comes in via @platejs/math → BaseMathKit → BaseEditorKit.
        noExternal: [/^@platejs\//, "platejs", "@udecode/utils", "katex", "react-tweet"],
      },
    },
  },
  optimizeDeps: {
    // Defense against server-only deps leaking into the client dep-prebundler.
    // If a server fn module is ever scanned for client (during route-tree
    // analysis), these node-only packages would otherwise be eagerly bundled
    // and crash on Buffer/process references at module load.
    // `@base-ui/react` is excluded per the RSC plugin's inconsistent-
    // optimization warning (client components consumed across SSR + RSC
    // envs).
    exclude: ["postgres", "drizzle-orm/postgres-js", "@base-ui/react"],
    // Force-include CJS-only `use-sync-external-store` so Vite extracts its
    // named exports correctly. The shim uses a `module.exports = require(...)`
    // indirection that Vite's auto-scan misses.
    //
    // Recharts is pinned here for the same reason — its internals reach into
    // React through a CJS shim that Vite 7's deps bundler otherwise wires up
    // inconsistently (the dev server occasionally serves a `recharts.js` that
    // imports a stale `react.js` chunk, surfacing as
    // `TypeError: require_react is not a function`). Explicit inclusion makes
    // the pre-bundle deterministic.
    // Plate editor deps are only reachable via the lazily-loaded editor route
    // (and the router's own `?tsr-split=component` chunk), so Vite's startup
    // scan never sees them. First nav to the editor makes Vite discover the
    // whole `@platejs/*` graph, re-run dep optimization, bump the `?v=` hash,
    // and reload — which kills any in-flight dynamic import with "Failed to
    // fetch dynamically imported module". Force-including every editor
    // specifier (subpaths included — Plate's `/react` entries optimize
    // separately) makes the pre-bundle deterministic at startup, so no
    // mid-session re-optimization. Same rationale as `recharts` above.
    include: [
      "use-sync-external-store/shim",
      "use-sync-external-store/shim/with-selector",
      "recharts",
      "platejs",
      "platejs/react",
      "platejs/static",
      "@platejs/ai/react",
      "@platejs/autoformat",
      "@platejs/basic-nodes",
      "@platejs/basic-nodes/react",
      "@platejs/basic-styles",
      "@platejs/basic-styles/react",
      "@platejs/callout",
      "@platejs/callout/react",
      "@platejs/caption",
      "@platejs/caption/react",
      "@platejs/combobox",
      "@platejs/combobox/react",
      "@platejs/date",
      "@platejs/date/react",
      "@platejs/dnd",
      "@platejs/emoji",
      "@platejs/emoji/react",
      "@platejs/floating",
      "@platejs/indent",
      "@platejs/indent/react",
      "@platejs/layout",
      "@platejs/layout/react",
      "@platejs/link",
      "@platejs/link/react",
      "@platejs/list",
      "@platejs/list/react",
      "@platejs/markdown",
      "@platejs/media",
      "@platejs/media/react",
      "@platejs/resizable",
      "@platejs/selection/react",
      "@platejs/slash-command/react",
      "@platejs/toc",
      "@platejs/toc/react",
      "@platejs/toggle",
      "@platejs/toggle/react",
      "@tanstack/react-pacer",
    ],
  },
});

export default config;
