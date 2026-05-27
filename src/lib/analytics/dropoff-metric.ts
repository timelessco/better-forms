// Mode-aware dropoff: denominator depends on Form shape.
// - Multi-step (stepCount>1): Step rows = View→Complete (viewed-not-completed);
//   nested Question rows = Start→Complete (isolate per-Question dropout).
// - Single-page (stepCount===1): whole page is one View, so Start→Complete everywhere.

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
