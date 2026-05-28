import { createPlatePlugin } from "platejs/react";
import type { RenderNodeWrapper } from "platejs/react";

import { cn } from "@/lib/utils";

export type AIDiffMark = "insert" | "remove";

// Element-level marker read by diff wrapper. AI-gen hook stamps it post-stream for the red/green accept/discard preview.
export const AI_DIFF_KEY = "aiDiff" as const;

const renderDiffWrapper: RenderNodeWrapper = ({ element }) => {
  const mark = (element as { aiDiff?: AIDiffMark }).aiDiff;
  if (!mark) return;
  return ({ children }) => (
    <div
      data-ai-diff={mark}
      className={cn(
        "rounded-sm",
        mark === "insert" && "bg-emerald-100/70 ring-1 ring-emerald-200/80",
        mark === "remove" && "bg-red-100/70 opacity-80 ring-1 ring-red-200/80",
      )}
    >
      {children}
    </div>
  );
};

export const AIDiffPlugin = createPlatePlugin({
  key: "ai_diff",
  render: { aboveNodes: renderDiffWrapper },
});

export const AIDiffKit = [AIDiffPlugin];
