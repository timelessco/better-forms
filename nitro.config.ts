import evlog from "evlog/nitro/v3";
import { defineConfig } from "nitro";

export default defineConfig({
  node: true,
  experimental: {
    asyncContext: true,
  },
  modules: [
    evlog({
      env: { service: "reform", environment: process.env.NODE_ENV },
      enabled: true,
    }),
  ],
});
