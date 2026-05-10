import type { KnipConfig } from "knip";

export default {
  entry: [
    "src/routes/**/*.{ts,tsx}", // Routes as entry points
    "src/embed/*.ts", // Embed scripts
    "instrument.server.mjs", // Sentry
  ],
  project: ["src/**/*.{ts,tsx}"],
  ignore: [
    ".output/**",
    "drizzle/**",
    "public/**",
    "src/routeTree.gen.ts",
    "src/components/ui/**", // shadcn - used dynamically
    "src/components/editor/plugins/**", // plate plugins - library exports
    "src/lib/editor/ai-form-nodes.ts", // AI form builder - consumed by upcoming AI generation task
    "src/lib/editor/ai-icon-matcher.ts", // AI icon matcher - consumed by upcoming AI generation task
    "src/lib/config/plan-config.ts", // Custom domains feature - consumed by upcoming tasks
    "src/lib/vercel-domains.ts", // Custom domains feature - consumed by upcoming tasks
    "src/lib/server-fn/custom-domains.ts", // Custom domains feature - consumed by upcoming tasks
    "src/lib/server-fn/custom-domain-loader.ts", // Custom domains feature - consumed by upcoming tasks
    "src/lib/server-fn/analytics.ts", // Analytics v1 - consumed by upcoming tasks
    "src/components/evilcharts/**", // evilcharts package - some components are intentionally unused
    "src/types/**", // type exports
    "vite.config.ts", // config file default export
  ],
  ignoreDependencies: [
    "@tanstack/router-plugin", // vite plugin
    "tailwind-scrollbar-hide", // tailwind plugin
    "tw-animate-css", // tailwind plugin
    "2026-01-08-platjs", // self-reference
    "katex", // used in CSS
    "@sentry/tanstackstart-react", // used in instrument.server.mjs (knip entry misses it)
    "shadcn", // imported in src/styles/styles.css
    "tailwindcss", // vite plugin + CSS @import
    "type-fest", // HasRequiredKeys type import in auth-query.ts
    "agentation", // reserved for in-progress devtools work (commented import in src/routes/-components/devtools.tsx)
    "@takumi-rs/core", // SSR-external in vite.config.ts; runtime peer of @takumi-rs/image-response
    "@takumi-rs/helpers", // SSR-external in vite.config.ts; runtime peer of @takumi-rs/image-response
    "@takumi-rs/wasm", // resolved at runtime via require.resolve("@takumi-rs/wasm/takumi_wasm_bg.wasm") in src/lib/og/render.server.ts
  ],
  ignoreExportsUsedInFile: true,
  rules: {
    unlisted: "off", // dev deps in config files are expected
  },
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].join("\n"),
  },
} satisfies KnipConfig;
