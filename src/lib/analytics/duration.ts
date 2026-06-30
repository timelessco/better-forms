// Visit durationMs is wall-clock tab-open time (page load → beforeunload/pagehide), so an abandoned
// or backgrounded tab can record hours and wreck the "avg time on form" stat. Cap it at a sane upper
// bound for actually filling a form — anything longer is treated as this max. Applied at BOTH record
// time (use-public-form-tracking) and aggregation/read time (so existing long rows are bounded too).
export const MAX_VISIT_DURATION_MS = 1_800_000; // 30 min

export const cappedDurationMs = (ms: number): number =>
  Math.min(Math.max(0, ms), MAX_VISIT_DURATION_MS);
