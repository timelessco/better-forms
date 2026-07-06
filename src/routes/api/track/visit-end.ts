import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";

// Spam guards for client-reported vitals — reject absurd payloads only. LCP/INP ms, CLS unitless.
const MAX_VITAL_MS = 3_600_000; // 1h
const MAX_CLS = 100;

/** Unload beacon payload: visit-end timestamp + optional vitals from beforeunload/pagehide. Local mirror of serverFn schema — decoupled from broader updateFormVisit (admin-only fields). */
const visitEndBeaconSchema = v.object({
  visitId: v.pipe(v.string(), v.uuid()),
  visitEndedAt: v.pipe(v.string(), v.isoTimestamp()),
  lcpMs: v.nullish(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_VITAL_MS))),
  inpMs: v.nullish(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_VITAL_MS))),
  cls: v.nullish(v.pipe(v.number(), v.minValue(0), v.maxValue(MAX_CLS))),
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
        const parsed = v.safeParse(visitEndBeaconSchema, body);
        if (!parsed.success) {
          return new Response(null, { status: 400 });
        }
        const { updateFormVisitImpl } = await import("@/lib/server-fn/analytics.server");
        await updateFormVisitImpl(parsed.output);
        return new Response(null, { status: 204 });
      },
    },
  },
});
