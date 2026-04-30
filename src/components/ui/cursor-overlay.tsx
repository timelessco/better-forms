import { useCursorOverlay } from "@platejs/selection/react";
import type { CursorData, CursorOverlayState } from "@platejs/selection/react";
import { RangeApi } from "platejs";

import { cn } from "@/lib/utils";

export const CursorOverlay = () => {
  const { cursors } = useCursorOverlay();

  return (
    <>
      {cursors.map((cursor) => (
        <Cursor key={cursor.id} {...cursor} />
      ))}
    </>
  );
};

const Cursor = ({
  id,
  caretPosition,
  data,
  selection,
  selectionRects,
}: CursorOverlayState<CursorData>) => {
  const { style, selectionStyle = style } = data ?? ({} as CursorData);
  const isCursor = RangeApi.isCollapsed(selection);

  return (
    <>
      {selectionRects.map((position) => (
        <div
          key={`${position.left}-${position.top}-${position.width}-${position.height}`}
          className={cn(
            "pointer-events-none absolute z-10",
            id === "selection" && "bg-brand/25",
            id === "selection" && isCursor && "bg-primary",
          )}
          style={{
            ...selectionStyle,
            ...position,
          }}
        />
      ))}
      {caretPosition && (
        <div
          className={cn(
            "pointer-events-none absolute z-10 w-0.5",
            id === "drag" && "bg-brand w-px",
          )}
          style={{ ...caretPosition, ...style }}
        />
      )}
    </>
  );
};
