import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MAX_DURATION_MS = 86_400_000;

/** Unload beacon payload: only the three fields the client sends from
 *  `beforeunload` / `pagehide`. Mirror of the serverFn schema for these
 *  fields — kept local so the beacon route stays decoupled from the broader
 *  `updateFormVisit` shape (which includes optional admin-only fields). */
const visitEndBeaconSchema = z.object({
  visitId: z.uuid(),
  visitEndedAt: z.iso.datetime(),
  durationMs: z.number().int().nonnegative().max(MAX_DURATION_MS),
});

export const Route = createFileRoute("/api/track/visit-end")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: unknown;
        try {
          // sendBeacon ships the JSON as a text/plain Blob to stay CORS-safelisted
          // (skips preflight on cross-origin embeds), so we parse the raw text.
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
