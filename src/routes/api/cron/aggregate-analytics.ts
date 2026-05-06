import { createFileRoute } from "@tanstack/react-router";
import { getRequestUrl } from "@tanstack/react-start/server";
import { toDateKey } from "@/lib/analytics/time-range";
import { aggregateAnalyticsDaily } from "@/lib/server-fn/analytics";
import { isCronAuthorized } from "@/lib/server-fn/cron-auth";

const MS_PER_DAY = 86_400_000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const resolveDateKey = (): string => {
  const overrideDate = getRequestUrl().searchParams.get("date");
  if (overrideDate && DATE_KEY_RE.test(overrideDate)) {
    return overrideDate;
  }
  // Aggregate yesterday's UTC date — today is still being recorded.
  return toDateKey(new Date(Date.now() - MS_PER_DAY));
};

export const Route = createFileRoute("/api/cron/aggregate-analytics")({
  server: {
    handlers: {
      GET: async () => {
        if (!isCronAuthorized()) {
          return new Response("forbidden", { status: 403 });
        }
        const dateKey = resolveDateKey();
        const result = await aggregateAnalyticsDaily({ data: { date: dateKey } });
        return Response.json(result);
      },
    },
  },
});
