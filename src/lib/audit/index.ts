// Server-only helper: resolve the request-scoped audit logger. The instrumentation
// phase calls getAuditLogger()?.audit(action({...})) at sensitive call sites.
//
// Reaches the logger via the Nitro ALS accessor (same path as
// src/lib/auth/middleware.ts). Returns undefined outside a request scope or when
// evlog isn't wired — callers no-op gracefully. The `audit` method is attached by
// evlog's logger; withAuditMethods() guarantees it for loggers that predate it.
// Marks this module server-only so the `nitro/context` import below never enters
// the client graph. Without it, client-scanned server-fn callers (e.g.
// submissions.ts) pull the Nitro runtime import client-side, which resolves to
// Nitro's no-op stub and logs "Nitro runtime imports detected ... stub
// implementation will be used". Same marker as src/db/schema.ts.
import "@tanstack/react-start/server-only";
import type { AuditableLogger, RequestLogger } from "evlog";
import { withAuditMethods } from "evlog";
// Aliased: Nitro ALS accessor, not a React hook (oxlint rules-of-hooks).
import { useRequest as getNitroRequest } from "nitro/context";

// Returns the audit-capable request logger, or undefined when unavailable.
export const getAuditLogger = (): AuditableLogger | undefined => {
  const log = getNitroRequest().context?.log as RequestLogger | undefined;
  if (!log) return undefined;
  return withAuditMethods(log);
};
