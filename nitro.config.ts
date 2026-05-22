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
      // PII safety net — auto-masks emails, IPs, phones, JWTs, Bearer
      // tokens, credit cards, and IBANs in every wide event before drain
      // or console emit. Complements explicit field selection elsewhere.
      redact: true,
    }),
  ],
});
