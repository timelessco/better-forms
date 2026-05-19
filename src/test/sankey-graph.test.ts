import { describe, expect, it } from "vitest";

import { buildSankeyGraph } from "@/lib/analytics/sankey-graph";
import type { QuestionDropoffMetrics, QuestionDropoffRow } from "@/types/analytics";

const makeQuestion = (overrides: Partial<QuestionDropoffRow>): QuestionDropoffRow => ({
  questionId: "q1",
  questionIndex: 0,
  questionLabel: undefined,
  stepId: "step_0",
  stepIndex: 0,
  viewCount: 0,
  startCount: 0,
  completeCount: 0,
  dropoffCount: 0,
  terminalDropoffCount: 0,
  dropoffRate: 0,
  completionRate: 0,
  ...overrides,
});

const makeMetrics = (questions: QuestionDropoffRow[]): QuestionDropoffMetrics => ({
  formId: "form_1",
  startDate: "2026-05-01",
  endDate: "2026-05-18",
  questions,
  totalStarted: 0,
  totalCompleted: 0,
  overallCompletionRate: 0,
});

describe("buildSankeyGraph", () => {
  it("returns empty graph when there are no steps", () => {
    const graph = buildSankeyGraph(makeMetrics([]));
    expect(graph.nodes).toEqual([]);
    expect(graph.links).toEqual([]);
  });

  it("creates one node per Step plus a terminal exit node", () => {
    const graph = buildSankeyGraph(
      makeMetrics([
        makeQuestion({ questionId: "q1", stepId: "step_0", stepIndex: 0, viewCount: 100 }),
        makeQuestion({
          questionId: "q2",
          questionIndex: 1,
          stepId: "step_1",
          stepIndex: 1,
          viewCount: 70,
        }),
      ]),
    );

    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes[0]).toEqual({ name: "Step 1", kind: "step" });
    expect(graph.nodes[1]).toEqual({ name: "Step 2", kind: "step" });
    expect(graph.nodes[2]).toEqual({ name: "Drop-off", kind: "exit" });
  });

  it("uses next.viewCount for flow links and terminalDropoffCount for exit links", () => {
    const graph = buildSankeyGraph(
      makeMetrics([
        makeQuestion({
          questionId: "q1",
          stepId: "step_0",
          stepIndex: 0,
          viewCount: 100,
          terminalDropoffCount: 30,
        }),
        makeQuestion({
          questionId: "q2",
          questionIndex: 1,
          stepId: "step_1",
          stepIndex: 1,
          viewCount: 70,
          terminalDropoffCount: 20,
        }),
      ]),
    );

    const exitIndex = 2;
    expect(graph.links).toContainEqual({ source: 0, target: 1, value: 70, kind: "flow" });
    expect(graph.links).toContainEqual({
      source: 0,
      target: exitIndex,
      value: 30,
      kind: "dropoff",
    });
    expect(graph.links).toContainEqual({
      source: 1,
      target: exitIndex,
      value: 20,
      kind: "dropoff",
    });
  });

  it("drops zero-value links so Recharts doesn't render noise", () => {
    const graph = buildSankeyGraph(
      makeMetrics([
        makeQuestion({
          questionId: "q1",
          stepId: "step_0",
          stepIndex: 0,
          viewCount: 100,
          terminalDropoffCount: 0,
        }),
        makeQuestion({
          questionId: "q2",
          questionIndex: 1,
          stepId: "step_1",
          stepIndex: 1,
          viewCount: 0,
          terminalDropoffCount: 0,
        }),
      ]),
    );

    expect(graph.links).toHaveLength(0);
  });
});
