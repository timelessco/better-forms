// evlog drain + audit pipeline. Registered at runtime via nitro.config.ts
// `plugins` (resolved absolute, mirroring evlog's own nitro module). The evlog
// nitro module already wires the Nitro-level errorHandler and the wide-event
// emit/redact pipeline — this plugin only attaches the drains + audit enricher.
//
// Pipeline (per emitted wide event):
//   evlog:enrich → auditEnricher fills audit.context (requestId/ip/ua/tenant)
//   evlog:drain  → fs (dev) + axiom (when key set) + tamper-evident audit-only fs
import { auditEnricher, auditOnly, signed } from "evlog";
import { createAxiomDrain } from "evlog/axiom";
import { createFsDrain } from "evlog/fs";
import { createDrainPipeline } from "evlog/pipeline";
// Nitro v3 plugin factory (evlog's own plugin imports the same symbol).
import { definePlugin } from "nitro";
import type { DrainContext } from "evlog";
import type { PipelineDrainFn } from "evlog/pipeline";

const isProduction = process.env.NODE_ENV === "production";
// Empty string env var must not enable the Axiom sink (would 401 per request).
const hasAxiom = Boolean(process.env.AXIOM_API_KEY);

export default definePlugin((nitroApp) => {
  const drains: Array<(ctx: DrainContext) => void | Promise<void>> = [];

  // Local NDJSON sink for the analyze-logs skill. Dev only — prod ships to Axiom.
  if (!isProduction) {
    drains.push(createFsDrain());
  }

  // Production sink. Batches + retries through a pipeline so a slow/flaky Axiom
  // ingest never blocks request emit; the pipeline calls createAxiomDrain() with
  // a DrainContext[] (the Axiom adapter accepts arrays). Reads AXIOM_API_KEY +
  // AXIOM_DATASET from env. flush() on Nitro "close" drains buffered events.
  let axiomPipelineFn: PipelineDrainFn<DrainContext> | undefined;
  if (hasAxiom) {
    axiomPipelineFn = createDrainPipeline<DrainContext>({
      batch: { size: 50, intervalMs: 5000 },
      retry: { maxAttempts: 3, backoff: "exponential", initialDelayMs: 1000 },
      onDropped: (events, error) => {
        console.warn(`evlog: dropped ${events.length} Axiom events`, error?.message);
      },
    })(createAxiomDrain());
    // Pipeline fn is sync (buffers + schedules); wrap to match the drain signature.
    drains.push((ctx) => axiomPipelineFn?.(ctx));
  }

  // Tamper-evident audit-only journal: hash-chain over an NDJSON file.
  // `await: true` flushes before the request resolves (crash-safe).
  // NOTE: chain state is in-memory (default) — it restarts each process boot,
  // so cross-restart/multi-instance continuity is NOT yet guaranteed. Persist
  // SignedChainState.{load,save} (file/Redis) before treating this as a
  // compliance artefact. Tracked as a follow-up.
  drains.push(
    auditOnly(signed(createFsDrain({ dir: ".evlog/audit" }), { strategy: "hash-chain" }), {
      await: true,
    }),
  );

  // Auto-fill audit.context on every audit-bearing event; passes others through.
  // tenantId resolver populates audit.context.tenantId centrally so isolation no
  // longer relies solely on call-site target.tenantId. The active org id is a
  // top-level wide-event field (set upstream by the auth middleware).
  nitroApp.hooks.hook(
    "evlog:enrich",
    auditEnricher({
      tenantId: (ctx) => {
        const orgId = ctx.event.activeOrganizationId;
        return typeof orgId === "string" ? orgId : undefined;
      },
    }),
  );

  // Drains fail in isolation (allSettled) — a dead Axiom call never blocks the
  // FS audit journal.
  nitroApp.hooks.hook("evlog:drain", async (ctx) => {
    await Promise.allSettled(drains.map((drain) => drain(ctx)));
  });

  // Flush buffered Axiom events on shutdown so in-flight batches aren't lost.
  nitroApp.hooks.hook("close", () => axiomPipelineFn?.flush());
});
