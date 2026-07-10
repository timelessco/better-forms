import type {
  formAnalyticsDaily,
  formDropoffDaily,
  formQuestionProgress,
  formVisits,
} from "@/db/schema";
import { cappedDurationMs } from "./duration";
import { median } from "./metrics";
import { resolveSource } from "./source";
import { buildHistogram } from "./vitals";

type RawVisit = typeof formVisits.$inferSelect;
type RawProgress = typeof formQuestionProgress.$inferSelect;
type DailyAnalyticsInsert = typeof formAnalyticsDaily.$inferInsert;
type DailyDropoffInsert = typeof formDropoffDaily.$inferInsert;

// dropoffRate/completionRate stored as percentage * 100 (50% → 5000). Scaled int
// for forensic queries; read side recomputes from raw counts.
const PERCENT_SCALE = 100;

const computeAverage = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return Math.round(sum / values.length);
};

export const bumpKey = (target: Record<string, number>, key: string | null | undefined): void => {
  if (!key) {
    return;
  }
  target[key] = (target[key] ?? 0) + 1;
};

/** One DailyAnalyticsInsert row per form, grouped by formId. dateKey: YYYY-MM-DD UTC.
 * The completion-time median is built only from visits that submitted (their server-written durationMs). */
export const buildDailyAnalyticsRows = (
  visits: RawVisit[],
  dateKey: string,
  now: Date,
): DailyAnalyticsInsert[] => {
  if (visits.length === 0) {
    return [];
  }

  const groups = new Map<string, RawVisit[]>();
  for (const visit of visits) {
    const list = groups.get(visit.formId);
    if (list) {
      list.push(visit);
    } else {
      groups.set(visit.formId, [visit]);
    }
  }

  const rows: DailyAnalyticsInsert[] = [];

  for (const [formId, group] of groups) {
    const uniqueVisitorHashes = new Set<string>();
    const uniqueSubmitterHashes = new Set<string>();
    let totalSubmissions = 0;
    const durations: number[] = [];

    const deviceBreakdown: Record<string, number> = {};
    const browserBreakdown: Record<string, number> = {};
    const osBreakdown: Record<string, number> = {};
    const countryBreakdown: Record<string, number> = {};
    const cityBreakdown: Record<string, number> = {};
    const sourceBreakdown: Record<string, number> = {};

    // Non-null CWV samples, this form's day.
    const lcpSamples: number[] = [];
    const inpSamples: number[] = [];
    const clsSamples: number[] = [];

    for (const visit of group) {
      uniqueVisitorHashes.add(visit.visitorHash);

      if (visit.didSubmit) {
        totalSubmissions += 1;
        uniqueSubmitterHashes.add(visit.visitorHash);
      }

      // Completion time = server-written durationMs snapshot; submitted visits only, capped.
      if (visit.didSubmit && visit.durationMs !== null) {
        durations.push(cappedDurationMs(visit.durationMs));
      }

      if (visit.lcpMs !== null && visit.lcpMs !== undefined) {
        lcpSamples.push(visit.lcpMs);
      }
      if (visit.inpMs !== null && visit.inpMs !== undefined) {
        inpSamples.push(visit.inpMs);
      }
      if (visit.cls !== null && visit.cls !== undefined) {
        clsSamples.push(visit.cls);
      }

      bumpKey(deviceBreakdown, visit.deviceType);
      bumpKey(browserBreakdown, visit.browser ?? "Other");
      bumpKey(osBreakdown, visit.os ?? "Other");
      bumpKey(countryBreakdown, visit.country);
      bumpKey(cityBreakdown, visit.city);

      const sourceKey = resolveSource({ utmSource: visit.utmSource, referrer: visit.referrer });
      sourceBreakdown[sourceKey] = (sourceBreakdown[sourceKey] ?? 0) + 1;
    }

    rows.push({
      id: crypto.randomUUID(),
      formId,
      date: dateKey,
      totalVisits: group.length,
      uniqueVisitors: uniqueVisitorHashes.size,
      totalSubmissions,
      uniqueSubmitters: uniqueSubmitterHashes.size,
      avgDurationMs: computeAverage(durations),
      medianDurationMs: median(durations),
      deviceBreakdown,
      browserBreakdown,
      osBreakdown,
      countryBreakdown,
      cityBreakdown,
      sourceBreakdown,
      lcpHistogram: buildHistogram("lcp", lcpSamples),
      inpHistogram: buildHistogram("inp", inpSamples),
      clsHistogram: buildHistogram("cls", clsSamples),
      createdAt: now,
      updatedAt: now,
    });
  }

  return rows;
};

/** Minimal visit shape for terminal-drop attribution in {@link buildDailyDropoffRows}. */
export type VisitForRollup = {
  id: string;
  didSubmit: boolean;
  visitEndedAt: Date | null;
};

/**
 * One DailyDropoffInsert row per (formId, questionId, questionIndex) group. Per ADR-0002:
 * - dropoffCount = "started, not completed" (intra-Question), NOT viewCount-completeCount.
 * - terminalDropoffCount = per-Visit: for each incomplete Visit (didSubmit=false,
 *   visitEndedAt!=null), latest-startedAt Question with no completedAt; +1 once.
 * - stepId/stepIndex pass-through from a representative row (agree within group, Task 3.2).
 * NOTE: every progress row has non-null viewedAt, so viewCount===0 can't occur; still
 * guard divide-by-zero (null rates).
 */
export const buildDailyDropoffRows = ({
  rows: progressEvents,
  visits,
  dateKey,
  now,
}: {
  rows: readonly RawProgress[];
  visits: readonly VisitForRollup[];
  dateKey: string;
  now: Date;
}): DailyDropoffInsert[] => {
  if (progressEvents.length === 0) {
    return [];
  }

  // Terminal-drop per Visit: incomplete Visit's latest-startedAt Question w/ null completedAt, +1.
  const visitsById = new Map<string, VisitForRollup>();
  for (const v of visits) {
    visitsById.set(v.id, v);
  }

  const rowsByVisit = new Map<string, RawProgress[]>();
  for (const event of progressEvents) {
    const list = rowsByVisit.get(event.visitId);
    if (list) {
      list.push(event);
    } else {
      rowsByVisit.set(event.visitId, [event]);
    }
  }

  const terminalCount = new Map<string, number>();
  for (const [visitId, vRows] of rowsByVisit) {
    const visit = visitsById.get(visitId);
    if (!visit) {
      continue;
    }
    if (visit.didSubmit) {
      continue;
    }
    if (!visit.visitEndedAt) {
      continue;
    }
    let terminal: RawProgress | null = null;
    let terminalTs = -Infinity;
    for (const row of vRows) {
      if (row.startedAt === null) {
        continue;
      }
      if (row.completedAt !== null) {
        continue;
      }
      const ts = row.startedAt.getTime();
      if (ts > terminalTs) {
        terminal = row;
        terminalTs = ts;
      }
    }
    if (terminal !== null) {
      const key = terminal.questionId;
      terminalCount.set(key, (terminalCount.get(key) ?? 0) + 1);
    }
  }

  type GroupKey = string;
  const groups = new Map<
    GroupKey,
    {
      formId: string;
      questionId: string;
      questionIndex: number;
      stepId: string | null;
      stepIndex: number | null;
      events: RawProgress[];
    }
  >();

  for (const event of progressEvents) {
    const key = `${event.formId} ${event.questionId} ${event.questionIndex}`;
    const existing = groups.get(key);
    if (existing) {
      existing.events.push(event);
    } else {
      groups.set(key, {
        formId: event.formId,
        questionId: event.questionId,
        questionIndex: event.questionIndex,
        stepId: event.stepId,
        stepIndex: event.stepIndex,
        events: [event],
      });
    }
  }

  const rows: DailyDropoffInsert[] = [];

  for (const group of groups.values()) {
    const viewCount = group.events.length;
    let startCount = 0;
    let completeCount = 0;
    let dropoffCount = 0;
    for (const event of group.events) {
      if (event.startedAt !== null) {
        startCount += 1;
      }
      if (event.completedAt !== null) {
        completeCount += 1;
      }
      // ADR-0002: dropoffCount = "started but not completed" (intra-Question).
      if (event.startedAt !== null && event.completedAt === null) {
        dropoffCount += 1;
      }
    }

    let dropoffRate: number | null = null;
    let completionRate: number | null = null;
    if (viewCount > 0) {
      dropoffRate = Math.round((dropoffCount / viewCount) * 100 * PERCENT_SCALE);
      completionRate = Math.round((completeCount / viewCount) * 100 * PERCENT_SCALE);
    }

    rows.push({
      id: crypto.randomUUID(),
      formId: group.formId,
      date: dateKey,
      stepId: group.stepId,
      stepIndex: group.stepIndex,
      questionId: group.questionId,
      questionIndex: group.questionIndex,
      viewCount,
      startCount,
      completeCount,
      dropoffCount,
      terminalDropoffCount: terminalCount.get(group.questionId) ?? 0,
      dropoffRate,
      completionRate,
      createdAt: now,
      updatedAt: now,
    });
  }

  return rows;
};
