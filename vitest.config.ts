import "dotenv/config";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

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
    exclude: ["node_modules", ".output", "drizzle"],
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
