import { useMemo } from "react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";

import { buildSankeyGraph } from "@/lib/analytics/sankey-graph";
import type { QuestionDropoffMetrics } from "@/types/analytics";

interface DropoffSankeyProps {
  dropoff: QuestionDropoffMetrics;
}

const numberFormatter = new Intl.NumberFormat("en-US");

// Experimental Step-flow visualization (ADR-0002). Renders consecutive Step
// transitions as a Sankey diagram with a terminal "Drop-off" sink for the
// terminal-drop count of each Step. Kept minimal on purpose — the entire
// component is designed to be removable.
export const DropoffSankey = ({ dropoff }: DropoffSankeyProps) => {
  const graph = useMemo(() => buildSankeyGraph(dropoff), [dropoff]);

  const isEmpty = graph.nodes.length === 0 || graph.links.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Not enough Step transitions to render the flow view yet.
      </div>
    );
  }

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={graph}
          nodePadding={24}
          nodeWidth={10}
          linkCurvature={0.5}
          iterations={32}
          node={{ stroke: "oklch(0.62 0.18 250)", fill: "oklch(0.62 0.18 250)" }}
          link={{ stroke: "oklch(0.62 0.18 250)", strokeOpacity: 0.25 }}
          margin={{ top: 12, right: 80, bottom: 12, left: 12 }}
        >
          <Tooltip
            formatter={(value: unknown) => {
              if (typeof value !== "number") {
                return String(value);
              }
              return numberFormatter.format(value);
            }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
};
