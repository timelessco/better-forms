import "dotenv/config";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const dbTestFiles = [
  "src/test/analytics-aggregate-terminal-dropoff.test.ts",
  "src/test/analytics-aggregate-utils.test.ts",
  "src/test/analytics-batch-upsert.test.ts",
  "src/test/analytics-cut-date.test.ts",
  "src/test/analytics-guards.test.ts",
  "src/test/analytics-merge-dropoff.test.ts",
  "src/test/analytics-merge-metrics.test.ts",
  "src/test/analytics-option-b.test.ts",
  "src/test/auth-auto-provision.test.ts",
  "src/test/auth-session-active-org.test.ts",
  "src/test/custom-domain-status.test.ts",
  "src/test/form-detail-routing.test.ts",
  "src/test/form-listing-favorites.test.ts",
  "src/test/local-draft-sync.test.ts",
  "src/test/plan-cleanup-vercel-sync.test.ts",
  "src/test/plan-cleanup.test.ts",
  "src/test/plan-read-enforcement.test.ts",
  "src/test/plan-webhook-handlers.test.ts",
  "src/test/plan-write-gates.test.ts",
  "src/test/submission-notifications.test.ts",
  "src/test/submission-summary.test.ts",
  "src/test/version-history.test.ts",
  "src/test/version-workflow.test.ts",
  "src/test/workspace-summary.test.ts",
  "src/lib/server-fn/ai-request-rate-limit.test.ts",
  "src/lib/server-fn/public-submissions.test.ts",
];

export default defineConfig({
  plugins: [
    // Vitest 3.x pins Vite ^7 — no native tsconfigPaths yet. Remove once
    // Vitest ships Vite 8 support.
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules",
      ".output",
      "drizzle",
      // CI skips DB-dependent tests — they're slow against remote Supabase.
      // Run the full suite locally via lefthook pre-push.
      ...(process.env.CI ? dbTestFiles : []),
    ],
    css: false,
    testTimeout: process.env.CI ? 120_000 : 30_000,
    hookTimeout: process.env.CI ? 120_000 : 30_000,
    poolOptions: {
      forks: {
        maxForks: 2,
      },
    },
  },
});
