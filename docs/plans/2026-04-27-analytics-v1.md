# Form Analytics v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a per-form analytics dashboard with visit tracking, question-level drop-off, and daily aggregates — using the schema and types already in the repo.

**Architecture:** Raw events on the public form (visits + question progress) → nightly Vercel Cron rolls up daily aggregates and prunes raw older than 90 days. Reads merge today's raw with prior-day aggregates. Plain React Query/loader on the read side. Zero new client deps; tracking is fire-and-forget with `sendBeacon`.

**Tech Stack:** Drizzle, TanStack Start server fns, TanStack Router, recharts (already installed), Vercel Cron, `vitest` for tests.

---

## What already exists (do not recreate)

- DB tables `formVisits`, `formQuestionProgress`, `formAnalyticsDaily`, `formDropoffDaily` — `src/db/schema.ts:368-506`. Drizzle relations done.
- Types in `src/types/analytics.ts` — `FormInsightsMetrics`, `QuestionDropoffMetrics`, `TimeRangeFilter`.
- Chart wrapper `src/components/ui/chart.tsx` (recharts).
- `vercel.json` exists (regions `bom1, iad1, fra1`) — extend, don't recreate.
- Workspace deletion already cascades analytics tables (`src/lib/server-fn/workspaces.ts:113-116`).

## What is missing (this plan delivers)

1. Server fns: tracking (`recordFormVisit`, `updateFormVisit`, `recordQuestionProgress`), reads (`getFormInsights`, `getFormDropoff`), cron (`aggregateAnalyticsDaily`).
2. Public-form client tracking module + hook.
3. Wire-up into `public-form-page.tsx` and `step-form.tsx` / `step-form-context.tsx` (additive, no refactor).
4. Insights route `/insights` under form-builder, with charts + funnel.
5. Vercel Cron entry in `vercel.json` + cron route handler.
6. Tests for: aggregation idempotency, hash logic, time-range merge, bot filter, retention prune.

---

## Locked decisions (from grilling)

- **Visitor identity:** localStorage `bf_vid` (UUID, workspace-global) + sessionStorage `bf_sid`.
- **UA / geo:** server-side parse of `user-agent`; geo from `x-vercel-ip-country`. No city in v1.
- **Bot filter:** JS-only recording + server-side UA regex blocklist.
- **Today freshness:** "Last 24h" reads `formVisits` directly; older reads `formAnalyticsDaily`.
- **Visit end:** `beforeunload` → `navigator.sendBeacon` → `updateFormVisit`. No heartbeats.
- **Retention:** raw 90 days, then pruned by cron.
- **Submission attribution:** atomic — `createPublicSubmission` accepts optional `visitId` and updates `formVisits` in same transaction.
- **Per-question tracking:** only on multi-step / field-by-field. Single-page forms get visit-level only.
- **`questionId`:** `field.id` for field-by-field, `step_${stepIndex}` for page-break.
- **Out of scope:** real-time counter, A/B, heatmaps, custom events, webhooks, journey timeline, dashboard summary cards.

---

## Files touched

**Create:**

- `src/lib/analytics/visitor-id.ts` — localStorage/sessionStorage helpers.
- `src/lib/analytics/track-client.ts` — fetch + sendBeacon wrappers (fire-and-forget).
- `src/lib/analytics/use-public-form-tracking.ts` — single hook used by `PublicFormPage`.
- `src/lib/analytics/parse-user-agent.ts` — server-only UA parser (no deps; small lookup table).
- `src/lib/analytics/bot-filter.ts` — server-only UA regex.
- `src/lib/analytics/time-range.ts` — pure helpers: `resolveTimeRange()`, `splitTodayVsPast()`.
- `src/lib/server-fn/analytics.ts` — all five public + cron fns.
- `src/routes/api/cron/aggregate-analytics.ts` — Vercel cron entry; validates header, calls `aggregateAnalyticsDaily(yesterday)`.
- `src/routes/_authenticated/workspace/$workspaceId/form-builder/$formId/insights.tsx` — UI route.
- `src/components/form-builder/insights/` — `metrics-row.tsx`, `time-series-chart.tsx`, `dropoff-funnel.tsx`, `breakdown-cards.tsx`, `time-range-selector.tsx`, `empty-state.tsx`.
- `src/test/analytics-aggregation.test.ts`
- `src/test/analytics-time-range.test.ts`
- `src/test/analytics-bot-filter.test.ts`
- `src/test/analytics-visitor-id.test.ts`

**Modify:**

- `src/lib/server-fn/public-submissions.ts` — `createPublicSubmission` accepts optional `visitId`; updates `formVisits.didSubmit`/`submissionId` in same TX.
- `src/routes/forms/-components/public-form-page.tsx` — call `usePublicFormTracking(...)`, thread `visitId` into `createPublicSubmission` and into `StepFormProvider`.
- `src/components/form-components/step-form-context.tsx` — accept optional `onQuestionComplete` callback; call inside `goToNextStep` and `submitForm`.
- `src/components/form-components/step-form.tsx` — call optional `onQuestionView` from `useMountEffect`.
- `src/components/form-components/use-preview-form.ts` — call optional `onQuestionStart` on first `onBlur` per step.
- `vercel.json` — add `crons` block.
- `src/routes/_authenticated/workspace/$workspaceId/form-builder/$formId/route.tsx` — add "Insights" tab/link.

---

## Tasks

Each task is one commit. After each task: run scoped tests if any. Do NOT run `vite build` or `tsc`.

### Task 1 — Time-range helpers (pure)

**Files:** Create `src/lib/analytics/time-range.ts`, `src/test/analytics-time-range.test.ts`.

Implement:

```ts
// src/lib/analytics/time-range.ts
import type { TimeRange, TimeRangeFilter } from "@/types/analytics";

export type ResolvedRange = { start: Date; end: Date; days: string[] }; // days: 'YYYY-MM-DD' inclusive

export function resolveTimeRange(input: TimeRange, now: Date = new Date()): ResolvedRange {
  /* ... */
}

/** Returns { todayStart, pastDays }. todayStart is the ISO start-of-day UTC for "now"; pastDays is the YYYY-MM-DD list excluding today. */
export function splitTodayVsPast(
  range: ResolvedRange,
  now: Date = new Date(),
): { todayStart: Date | null; pastDays: string[] } {
  /* ... */
}

export function toDateKey(d: Date): string {
  /* 'YYYY-MM-DD' UTC */
}
```

Tests cover: each `TimeRangeFilter` value, custom range, DST-irrelevant UTC keys, `splitTodayVsPast` excludes today from `pastDays`.

Run: `bun x vitest run src/test/analytics-time-range.test.ts`.

Commit: `feat(analytics): add time-range resolution helpers`.

### Task 2 — Visitor-id helpers (client only)

**Files:** Create `src/lib/analytics/visitor-id.ts`, `src/test/analytics-visitor-id.test.ts`.

```ts
const VISITOR_KEY = "bf_vid";
const SESSION_KEY = "bf_sid";

export function getOrCreateVisitorHash(): string {
  /* localStorage UUID v4; SSR-safe (returns "" on server) */
}
export function getOrCreateSessionId(): string {
  /* sessionStorage UUID v4 */
}
```

Use `crypto.randomUUID()` (available in all evergreen browsers + Node 20). Guard `typeof window === "undefined"` for SSR.

Tests use `happy-dom` (already in vitest setup if not, add only locally to test).

Commit: `feat(analytics): visitor + session id helpers`.

### Task 3 — Bot filter + UA parser (server only)

**Files:** Create `src/lib/analytics/bot-filter.ts`, `src/lib/analytics/parse-user-agent.ts`, `src/test/analytics-bot-filter.test.ts`.

```ts
// bot-filter.ts
const BOT_RE =
  /bot|crawl|spider|slurp|scrape|headless|preview|monitor|fetch|curl|wget|python-requests/i;
export function isBotUserAgent(ua: string | null | undefined): boolean {
  /* */
}
```

```ts
// parse-user-agent.ts — small hand-rolled (NO new dep)
export type ParsedUA = {
  deviceType: "desktop" | "mobile" | "tablet" | null;
  browser: string | null; // 'Chrome' | 'Firefox' | 'Safari' | 'Edge' | 'Opera' | 'Other'
  browserVersion: string | null;
  os: string | null; // 'Windows' | 'macOS' | 'iOS' | 'Android' | 'Linux' | 'Other'
  osVersion: string | null;
};
export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  /* regex matches; default 'Other' */
}
```

Tests: a handful of representative UA strings (Chrome desktop, Safari iOS, Googlebot, Edge Win11, Firefox Linux). Bot UAs return `true` from `isBotUserAgent`.

Commit: `feat(analytics): bot filter and UA parser`.

### Task 4 — Server fn: `recordFormVisit`

**Files:** Create `src/lib/server-fn/analytics.ts`.

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { db } from "@/db";
import { formVisits } from "@/db/schema";
import { isBotUserAgent } from "@/lib/analytics/bot-filter";
import { parseUserAgent } from "@/lib/analytics/parse-user-agent";

export const recordFormVisit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      formId: z.string().min(1),
      visitorHash: z.string().min(1),
      sessionId: z.string().min(1),
      referrer: z.string().nullish(),
      utmSource: z.string().nullish(),
      utmMedium: z.string().nullish(),
      utmCampaign: z.string().nullish(),
    }),
  )
  .handler(async ({ data }) => {
    const req = getRequest();
    const ua = req.headers.get("user-agent");
    if (isBotUserAgent(ua)) return { visitId: null }; // silently drop
    const parsed = parseUserAgent(ua);
    const country = req.headers.get("x-vercel-ip-country") ?? null;
    const countryName = req.headers.get("x-vercel-ip-country-region") ?? null;
    const id = crypto.randomUUID();
    await db.insert(formVisits).values({
      id,
      formId: data.formId,
      visitorHash: data.visitorHash,
      sessionId: data.sessionId,
      referrer: data.referrer ?? null,
      utmSource: data.utmSource ?? null,
      utmMedium: data.utmMedium ?? null,
      utmCampaign: data.utmCampaign ?? null,
      deviceType: parsed.deviceType,
      browser: parsed.browser,
      browserVersion: parsed.browserVersion,
      os: parsed.os,
      osVersion: parsed.osVersion,
      country,
      countryName,
      city: null,
      region: null,
    });
    return { visitId: id };
  });
```

Match existing `createServerFn` patterns from `src/lib/server-fn/public-submissions.ts`.

Commit: `feat(analytics): recordFormVisit server fn`.

### Task 5 — Server fn: `updateFormVisit` and `recordQuestionProgress`

**Files:** Modify `src/lib/server-fn/analytics.ts`.

```ts
export const updateFormVisit = createServerFn({ method: "POST" })
  .validator(
    z.object({
      visitId: z.string().min(1),
      didStartForm: z.boolean().optional(),
      didSubmit: z.boolean().optional(),
      submissionId: z.string().nullish(),
      visitEndedAt: z.string().datetime().nullish(),
      durationMs: z.number().int().nonnegative().nullish(),
    }),
  )
  .handler(async ({ data }) => {
    await db
      .update(formVisits)
      .set({
        ...(data.didStartForm !== undefined && { didStartForm: data.didStartForm }),
        ...(data.didSubmit !== undefined && { didSubmit: data.didSubmit }),
        ...(data.submissionId !== undefined && { submissionId: data.submissionId }),
        ...(data.visitEndedAt !== undefined && {
          visitEndedAt: data.visitEndedAt ? new Date(data.visitEndedAt) : null,
        }),
        ...(data.durationMs !== undefined && { durationMs: data.durationMs }),
        updatedAt: new Date(),
      })
      .where(eq(formVisits.id, data.visitId));
    return { ok: true };
  });

export const recordQuestionProgress = createServerFn({ method: "POST" })
  .validator(
    z.object({
      visitId: z.string().min(1),
      formId: z.string().min(1),
      visitorHash: z.string().min(1),
      questionId: z.string().min(1),
      questionType: z.string().nullish(),
      questionIndex: z.number().int().nonnegative(),
      event: z.enum(["view", "start", "complete"]),
      wasLastQuestion: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    // Upsert on (visitId, questionId): inserted on 'view', patched on 'start'/'complete'.
    const existing = await db.query.formQuestionProgress.findFirst({
      where: and(
        eq(formQuestionProgress.visitId, data.visitId),
        eq(formQuestionProgress.questionId, data.questionId),
      ),
    });
    const now = new Date();
    if (!existing) {
      await db.insert(formQuestionProgress).values({
        id: crypto.randomUUID(),
        visitId: data.visitId,
        formId: data.formId,
        visitorHash: data.visitorHash,
        questionId: data.questionId,
        questionType: data.questionType ?? null,
        questionIndex: data.questionIndex,
        viewedAt: now,
        startedAt: data.event === "start" || data.event === "complete" ? now : null,
        completedAt: data.event === "complete" ? now : null,
        wasLastQuestion: data.wasLastQuestion ?? false,
      });
    } else {
      await db
        .update(formQuestionProgress)
        .set({
          ...(data.event === "start" && !existing.startedAt && { startedAt: now }),
          ...(data.event === "complete" && {
            completedAt: now,
            ...(existing.startedAt ? {} : { startedAt: now }),
          }),
          ...(data.wasLastQuestion !== undefined && { wasLastQuestion: data.wasLastQuestion }),
        })
        .where(eq(formQuestionProgress.id, existing.id));
    }
    return { ok: true };
  });
```

Commit: `feat(analytics): updateFormVisit and recordQuestionProgress`.

### Task 6 — Wire submission attribution

**Files:** Modify `src/lib/server-fn/public-submissions.ts`.

Add optional `visitId: z.string().nullish()` to `createPublicSubmission` validator. Inside the existing transaction, after insert, if `visitId` is present and the visit row is for the same `formId`, run:

```ts
await tx
  .update(formVisits)
  .set({
    didSubmit: true,
    didStartForm: true,
    submissionId: insertedSubmission.id,
    updatedAt: new Date(),
  })
  .where(eq(formVisits.id, data.visitId));
```

Test: extend `src/test/submission-summary.test.ts` or create `src/test/analytics-submission-attribution.test.ts` — assert `didSubmit=true` after a submission with `visitId`.

Commit: `feat(analytics): attribute submissions to visits`.

### Task 7 — Client tracking module

**Files:** Create `src/lib/analytics/track-client.ts`.

```ts
import {
  recordFormVisit,
  updateFormVisit,
  recordQuestionProgress,
} from "@/lib/server-fn/analytics";

export async function fireRecordVisit(
  args: Parameters<typeof recordFormVisit>[0]["data"],
): Promise<string | null> {
  try {
    const r = await recordFormVisit({ data: args });
    return r?.visitId ?? null;
  } catch {
    return null;
  }
}

export function fireUpdateVisitBeacon(args: Parameters<typeof updateFormVisit>[0]["data"]): void {
  try {
    if (typeof navigator === "undefined" || !navigator.sendBeacon) {
      void updateFormVisit({ data: args }).catch(() => {});
      return;
    }
    const blob = new Blob([JSON.stringify({ data: args })], { type: "application/json" });
    navigator.sendBeacon("/_serverFn/analytics/updateFormVisit", blob);
  } catch {
    /* swallow */
  }
}

export function fireQuestionProgress(
  args: Parameters<typeof recordQuestionProgress>[0]["data"],
): void {
  void recordQuestionProgress({ data: args }).catch(() => {});
}
```

Note: confirm correct sendBeacon URL form for TanStack Start server fns; if `_serverFn` path differs, use whatever `recordFormVisit.url` exposes (TanStack Start gives you `.url` on server fns). Fallback path is the regular `await updateFormVisit(...)` which also works on `beforeunload` thanks to `keepalive` in the underlying fetch — keep that as a safety net.

Commit: `feat(analytics): client tracking module`.

### Task 8 — `usePublicFormTracking` hook

**Files:** Create `src/lib/analytics/use-public-form-tracking.ts`.

```ts
import { useEffect, useRef } from "react";
import { getOrCreateVisitorHash, getOrCreateSessionId } from "./visitor-id";
import { fireRecordVisit, fireUpdateVisitBeacon } from "./track-client";

export function usePublicFormTracking({
  formId,
  enabled = true,
}: {
  formId: string;
  enabled?: boolean;
}): {
  visitId: string | null;
  visitorHash: string;
} {
  const visitIdRef = useRef<string | null>(null);
  const visitorHashRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const visitorHash = getOrCreateVisitorHash();
    const sessionId = getOrCreateSessionId();
    visitorHashRef.current = visitorHash;
    startedAtRef.current = Date.now();

    const params = new URLSearchParams(window.location.search);
    fireRecordVisit({
      formId,
      visitorHash,
      sessionId,
      referrer: document.referrer || null,
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
    }).then((id) => {
      visitIdRef.current = id;
    });

    const onUnload = () => {
      const id = visitIdRef.current;
      if (!id) return;
      fireUpdateVisitBeacon({
        visitId: id,
        visitEndedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAtRef.current,
      });
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [formId, enabled]);

  return {
    get visitId() {
      return visitIdRef.current;
    },
    get visitorHash() {
      return visitorHashRef.current;
    },
  } as never;
  // Final return: a plain object with both refs read each render — see commit; using getters works because the object is recreated.
}
```

Tweak the return shape so consumers get the latest values (use `useState` to track `visitId` after the promise resolves, so React re-renders downstream when it lands).

Commit: `feat(analytics): usePublicFormTracking hook`.

### Task 9 — Wire tracking into public form

**Files:** Modify `src/routes/forms/-components/public-form-page.tsx`.

1. Inside `PublicFormPage`, call `const { visitId, visitorHash } = usePublicFormTracking({ formId });`.
2. In `handleSubmit` (line 307), pass `visitId ?? undefined` to `createPublicSubmission`.
3. Pass `{ visitId, visitorHash, formId, mode }` into `<StepFormProvider>` as a new prop `tracking={...}` (mode = `"page-break" | "field-by-field" | null`).

**Files:** Modify `src/components/form-components/step-form-context.tsx`.

Accept optional `tracking?: { visitId: string|null; visitorHash: string; formId: string; mode: string|null }` and `onComplete?(stepIndex, questionId, questionType)`. In `goToNextStep` and `submitForm`, if `tracking?.visitId`, call `fireQuestionProgress({...event: 'complete'})`. Compute `questionId` as `step_${stepIndex}` (page-break) or pass-through from a new context method `setActiveQuestionId(id, type)` that field-by-field mode calls on mount.

**Files:** Modify `src/components/form-components/step-form.tsx`.

In `useMountEffect`, call `fireQuestionProgress({event:'view', ...})` when `tracking?.visitId` is set.

**Files:** Modify `src/components/form-components/use-preview-form.ts`.

In the existing `onBlur` listener, track first blur per step in a ref; on first only, fire `event:'start'` and also `updateFormVisit({didStartForm:true})` once per visit.

Single-page mode (no steps): skip `recordQuestionProgress` entirely; only the visit + final submit fire.

Commit: `feat(analytics): wire tracking into public form`.

### Task 10 — Server fn: `getFormInsights` (read)

**Files:** Modify `src/lib/server-fn/analytics.ts`.

Reads merge raw + daily:

```ts
export const getFormInsights = createServerFn({ method: "POST" })
  .middleware([authMiddleware /* mirror existing pattern */])
  .validator(
    z.object({
      formId: z.string(),
      filter: z.enum(["last_24_hours", "last_7_days", "last_30_days", "last_90_days", "custom"]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }): Promise<FormInsightsMetrics> => {
    // 1. authz: confirm context.user owns formId via existing helpers
    // 2. resolve range
    // 3. fetch daily rows for pastDays
    // 4. fetch raw rows for today (if applicable)
    // 5. roll up: sum totalVisits/uniqueVisitors/submissions/avgDuration; merge breakdowns
    // 6. build dailyData[] using daily rows + a synthetic row for today computed from raw
    // 7. return FormInsightsMetrics
  });
```

Helper `mergeDailyAndRaw()` lives in `src/lib/analytics/merge-metrics.ts`. Test: `src/test/analytics-merge-metrics.test.ts` covers: empty days, today-only, mixed.

Commit: `feat(analytics): getFormInsights with raw+daily merge`.

### Task 11 — Server fn: `getFormDropoff` (read)

**Files:** Modify `src/lib/server-fn/analytics.ts`.

```ts
export const getFormDropoff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(/* same shape as insights */)
  .handler(async ({ data, context }): Promise<QuestionDropoffMetrics> => {
    // For pastDays: aggregate from formDropoffDaily.
    // For today: aggregate from formQuestionProgress (count distinct visitId per (questionId, event)).
    // Sort by questionIndex. Compute dropoffRate, completionRate per question.
  });
```

Commit: `feat(analytics): getFormDropoff server fn`.

### Task 12 — Aggregation cron fn

**Files:** Modify `src/lib/server-fn/analytics.ts`.

```ts
export const aggregateAnalyticsDaily = createServerFn({ method: "POST" })
  .validator(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data }) => {
    const { date } = data;
    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    await db.transaction(async (tx) => {
      // formAnalyticsDaily: delete existing rows for date, recompute from formVisits
      await tx.delete(formAnalyticsDaily).where(eq(formAnalyticsDaily.date, date));
      // group by formId -> compute counts/breakdowns -> insert
      // formDropoffDaily: same pattern from formQuestionProgress
      // Prune raw older than 90 days
      const cutoff = new Date(Date.now() - 90 * 86400_000);
      await tx.delete(formVisits).where(lt(formVisits.visitStartedAt, cutoff));
      await tx.delete(formQuestionProgress).where(lt(formQuestionProgress.viewedAt, cutoff));
    });
    return { ok: true };
  });
```

Test `src/test/analytics-aggregation.test.ts`: seed raw rows, run for date, assert daily rows exist, run again (idempotent — same row counts), older raw is pruned.

Commit: `feat(analytics): nightly aggregation + 90d pruning`.

### Task 13 — Vercel cron route

**Files:** Create `src/routes/api/cron/aggregate-analytics.ts`. Modify `vercel.json`.

```ts
// route: validates Vercel cron header, calls aggregateAnalyticsDaily(yesterday UTC)
import { createServerFileRoute } from "@tanstack/react-start/server";
import { aggregateAnalyticsDaily } from "@/lib/server-fn/analytics";

export const ServerRoute = createServerFileRoute("/api/cron/aggregate-analytics").methods({
  GET: async ({ request }) => {
    const auth = request.headers.get("authorization");
    const isCron =
      !!request.headers.get("x-vercel-cron") || auth === `Bearer ${process.env.CRON_SECRET}`;
    if (!isCron) return new Response("forbidden", { status: 403 });
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    await aggregateAnalyticsDaily({ data: { date: yesterday } });
    return Response.json({ ok: true, date: yesterday });
  },
});
```

`vercel.json` — add:

```json
"crons": [
  { "path": "/api/cron/aggregate-analytics", "schedule": "15 0 * * *" }
]
```

Set `CRON_SECRET` in Vercel project env (manual one-time step — call out in PR description).

Commit: `feat(analytics): vercel cron entry + route`.

### Task 14 — Insights route + components

**Files:** Create `src/routes/_authenticated/workspace/$workspaceId/form-builder/$formId/insights.tsx` and components in `src/components/form-builder/insights/`.

Layout:

```
<TimeRangeSelector />
<MetricsRow />              // Visits | Uniques | Submissions | Completion% | Avg Duration
<TimeSeriesChart />         // recharts AreaChart over dailyData[]
<DropoffFunnel />           // table: question, viewed, started, completed, dropoff%
<BreakdownCards />          // 2x2 grid: Devices (Pie), Sources (Bar), Countries (Table), Browsers (Pie)
```

Empty state: when `totalVisits === 0`, render `<EmptyStateHint />` overlaying the still-visible (zeroed) layout.

Use route loader to fetch both `getFormInsights` and `getFormDropoff` in parallel; show skeletons on `pendingComponent`.

Commit: `feat(analytics): insights route and dashboard UI`.

### Task 15 — Add Insights tab to form-builder shell

**Files:** Modify `src/routes/_authenticated/workspace/$workspaceId/form-builder/$formId/route.tsx`.

Add a tab/link "Insights" sibling to existing Edit / Settings / Submissions. Match the existing styling.

Commit: `feat(analytics): add Insights tab in form-builder`.

### Task 16 — Final pass + manual QA

**Manual checklist:**

- [ ] Create form, share link, open in incognito → visit row appears, UA/device/country populated.
- [ ] Submit form → `didSubmit=true`, `submissionId` filled.
- [ ] Multi-step: each step transition creates progress rows with `viewedAt < startedAt < completedAt`.
- [ ] Field-by-field popup: same.
- [ ] Single-page: only visit row; no progress rows.
- [ ] Close tab → `visitEndedAt` and `durationMs` populated (allow ~30s for sendBeacon).
- [ ] Curl with Googlebot UA → no row inserted.
- [ ] Manually invoke `aggregateAnalyticsDaily` with yesterday's date → daily rows appear; running again leaves same count.
- [ ] Insights page loads with data; empty state shows for fresh form.
- [ ] No new entries in dev-tools "Network" before form interactivity (verify tracking is post-paint).

Commit (if any cleanup): `chore(analytics): manual QA fixes`.

---

## Risks / open items

- **TanStack Start sendBeacon URL:** Server fns may not expose a stable URL string for `navigator.sendBeacon`. Fallback: `await updateFormVisit(...)` with `keepalive` in fetch (browsers honor `keepalive` for ≤64KB POSTs during unload). Confirm at Task 7.
- **`x-vercel-ip-country-region`** header name: verify exact header on Vercel; if wrong, leave `countryName` null in v1.
- **`field.id` stability across versions:** if a respondent's progress rows persist across a republish, the `questionId` should still match. Spot-check during Task 16.

## Done criteria

- All 14 implementation commits + Task 16 manual QA pass.
- `bun x vitest run` for analytics test files passes.
- A real visit through a real form populates `formVisits` + `formQuestionProgress`, and the Insights page renders charts with that data.
