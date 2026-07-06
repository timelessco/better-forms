// Completion time = the server-written `durationMs` snapshot: at final submit the finishing visit's
// row gets durationMs = (submit time − visitStartedAt), computed in SQL (public-submissions.ts). The
// client no longer writes durationMs, so the submit path is its sole, authoritative writer — a
// non-submitted visit's durationMs is null. A form left open for hours before submit can still record
// a huge span, so cap it at a sane upper bound for actually filling a form — anything longer is
// treated as this max. Applied at aggregation time; the read side takes the MEDIAN (not mean).
export const MAX_VISIT_DURATION_MS = 1_800_000; // 30 min

export const cappedDurationMs = (ms: number): number =>
  Math.min(Math.max(0, ms), MAX_VISIT_DURATION_MS);
