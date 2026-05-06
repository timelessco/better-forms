import { createFileRoute } from "@tanstack/react-router";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { isCronAuthorized } from "@/lib/server-fn/cron-auth";

const PURGE_GRACE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

// Hard-deletes forms that have been in the trash (status="archived") for more
// than 30 days. The countdown uses `updatedAt` — archive/restore both update
// it, so the timer correctly resets on restore. Matches the trash dialog copy
// "Pages in Trash for over 30 days will be automatically deleted".
//
// No CDN purge here — the cache was invalidated when each form transitioned
// to archived (see `bulkArchiveForms` and `updateForm`). By the time the
// cron runs, the edge has had 30 days of `not-cached` 404s; there's nothing
// left to purge. This cron is purely a DB janitor.
export const Route = createFileRoute("/api/cron/purge-archived-forms")({
  server: {
    handlers: {
      GET: async () => {
        if (!isCronAuthorized()) {
          return new Response("forbidden", { status: 403 });
        }

        const cutoff = new Date(Date.now() - PURGE_GRACE_DAYS * MS_PER_DAY);

        const purged = await db
          .delete(forms)
          .where(and(eq(forms.status, "archived"), lt(forms.updatedAt, cutoff)))
          .returning({ id: forms.id });

        return Response.json({
          purged: purged.length,
          cutoffIso: cutoff.toISOString(),
          ids: purged.map((p) => p.id),
        });
      },
    },
  },
});
