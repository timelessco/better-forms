import { createFileRoute } from "@tanstack/react-router";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { isCronAuthorized } from "@/lib/server-fn/cron-auth";

const PURGE_GRACE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

// Hard-delete forms archived >30 days. Countdown on updatedAt — archive/restore both touch it, so restore resets timer. Matches trash dialog copy.
// No CDN purge — cache invalidated on archive (bulkArchiveForms/updateForm); edge already serves 404s. Pure DB janitor.
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
