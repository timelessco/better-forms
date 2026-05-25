// Mode-aware dropoff rate helper.
//
// The Step funnel uses different denominators depending on Form shape because
// the per-row event counts mean different things between multi-step and
// single-page Forms:
//
// - Multi-step (`stepCount > 1`): Step rows count View → Complete transitions
//   for the whole step, so the meaningful drop-off is "viewed but didn't
//   complete the step". Between-step transitions follow the same metric.
//   Question rows nested inside a Step use Start → Complete because we want to
//   isolate the per-Question dropout independent of whether a Respondent
//   even started typing.
//
// - Single-page (`stepCount === 1`): there's no view/start distinction per
//   Question — the whole page is one View event. Use Start → Complete
//   everywhere so the percentage stays well-defined.

export type DropoffMode = "multi-step" | "single-page";

export interface DropoffMetricRow {
  viewCount: number;
  startCount: number;
  completeCount: number;
}

export type DropoffRowKind = "step" | "question";

export const modeForStepCount = (stepCount: number): DropoffMode =>
  stepCount > 1 ? "multi-step" : "single-page";

export const computeDropoffRate = (
  row: DropoffMetricRow,
  mode: DropoffMode,
  kind: DropoffRowKind = "step",
): number | null => {
  const useViewDenominator = mode === "multi-step" && kind === "step";
  const denominator = useViewDenominator ? row.viewCount : row.startCount;
  if (denominator <= 0) {
    return null;
  }
  const numerator = useViewDenominator
    ? row.viewCount - row.completeCount
    : row.startCount - row.completeCount;
  const safeNumerator = Math.max(0, numerator);
  return Math.round((safeNumerator / denominator) * 100);
};
