import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
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
  if (req.url?.startsWith("/embed/popup.js")) {
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

const config = defineConfig({
  plugins: [
    embedCacheHeadersPlugin(),
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
    nitro({
      vercel: {
        functions: {
          maxDuration: 799,
          runtime: "nodejs22.x",
          supportsResponseStreaming: true,
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
      // Embed manifest-managed CSS as an inline <style> in SSR HTML on prod
      // builds. Eliminates the blocking external stylesheet round-trip on the
      // first paint of public-form pages (-100-250ms LCP on cold visits) and
      // works alongside the existing route-scoped Early Hints. Experimental
      // flag — revert by setting `inlineCss: false` if anything regresses.
      server: {
        build: {
          inlineCss: true,
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
          // end up grouped with `editor` by Rollup's auto-chunker, which forces
          // every field chunk (InputField, TextareaField, …) that uses a Base
          // UI primitive to pull the full 361 kB platejs chunk + KaTeX CSS.
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
    include: [
      "use-sync-external-store/shim",
      "use-sync-external-store/shim/with-selector",
      "recharts",
    ],
  },
});

export default config;
