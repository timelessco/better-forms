import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MAX_DURATION_MS = 86_400_000;
// Spam guards for client-reported vitals — reject absurd payloads only. LCP/INP ms, CLS unitless.
const MAX_VITAL_MS = 3_600_000; // 1h
const MAX_CLS = 100;

/** Unload beacon payload: timing + optional vitals from beforeunload/pagehide. Local mirror of serverFn schema — decoupled from broader updateFormVisit (admin-only fields). */
const visitEndBeaconSchema = z.object({
  visitId: z.uuid(),
  visitEndedAt: z.iso.datetime(),
  durationMs: z.number().int().nonnegative().max(MAX_DURATION_MS),
  lcpMs: z.number().int().nonnegative().max(MAX_VITAL_MS).nullish(),
  inpMs: z.number().int().nonnegative().max(MAX_VITAL_MS).nullish(),
  cls: z.number().nonnegative().max(MAX_CLS).nullish(),
});

export const Route = createFileRoute("/api/track/visit-end")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          // sendBeacon ships JSON as text/plain Blob (CORS-safelisted, no preflight on cross-origin embeds) — parse raw text.
          body = JSON.parse(await request.text());
        } catch {
          return new Response(null, { status: 400 });
        }
        const parsed = visitEndBeaconSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(null, { status: 400 });
        }
        const { updateFormVisitImpl } = await import("@/lib/server-fn/analytics.server");
        await updateFormVisitImpl(parsed.data);
        return new Response(null, { status: 204 });
      },
    },
  },
});
