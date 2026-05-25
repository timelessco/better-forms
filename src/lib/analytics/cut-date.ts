// Pre-rework analytics rows are intentionally hidden from the funnel UI per
// ADR-0002. Older rows remain in the DB for Submission integrity but are
// excluded from insight reads. This timestamp was captured at the start of
// the rework deploy.
export const PER_QUESTION_ANALYTICS_CUT_TS = "2026-05-18T06:45:53Z";
