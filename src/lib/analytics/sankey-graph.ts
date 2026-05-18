import { rollupToSteps } from "@/lib/analytics/step-rollup";
import type { QuestionDropoffMetrics } from "@/types/analytics";

export interface SankeyGraphNode {
  name: string;
  // 'step' nodes correspond to a form Step. 'exit' is the terminal drop-off sink.
  kind: "step" | "exit";
}

export interface SankeyGraphLink {
  source: number;
  target: number;
  value: number;
  // 'flow' links connect consecutive Step nodes. 'dropoff' links connect a Step
  // node to the terminal 'exit' sink.
  kind: "flow" | "dropoff";
}

export interface SankeyGraph {
  nodes: SankeyGraphNode[];
  links: SankeyGraphLink[];
}

const STEP_ID_RE = /^step_(\d+)$/;

const stepLabelFromId = (stepId: string, stepIndex: number): string => {
  const match = stepId.match(STEP_ID_RE);
  if (match) {
    return `Step ${Number(match[1]) + 1}`;
  }
  return `Step ${stepIndex + 1}`;
};

// Transforms per-Question drop-off metrics into the nodes/links shape that
// Recharts' <Sankey> requires. Each Step becomes a node; consecutive Steps are
// connected by a 'flow' link valued at the next Step's view count (a view fires
// on Step mount, so next.viewCount == "started Step N+1 after completing Step N").
// Every Step also gets a 'dropoff' link to a shared terminal 'exit' sink valued
// at its terminalDropoffCount. Links with value 0 are dropped so Recharts
// doesn't render hairline noise.
export const buildSankeyGraph = (dropoff: QuestionDropoffMetrics): SankeyGraph => {
  const steps = rollupToSteps(dropoff.questions);
  if (steps.length === 0) {
    return { nodes: [], links: [] };
  }

  const nodes: SankeyGraphNode[] = steps.map((step) => ({
    name: stepLabelFromId(step.stepId, step.stepIndex),
    kind: "step",
  }));

  const exitIndex = nodes.length;
  nodes.push({ name: "Drop-off", kind: "exit" });

  const links: SankeyGraphLink[] = [];

  for (let i = 0; i < steps.length - 1; i += 1) {
    const next = steps[i + 1];
    if (!next) {
      continue;
    }
    if (next.viewCount > 0) {
      links.push({ source: i, target: i + 1, value: next.viewCount, kind: "flow" });
    }
  }

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (!step) {
      continue;
    }
    if (step.terminalDropoffCount > 0) {
      links.push({
        source: i,
        target: exitIndex,
        value: step.terminalDropoffCount,
        kind: "dropoff",
      });
    }
  }

  return { nodes, links };
};
