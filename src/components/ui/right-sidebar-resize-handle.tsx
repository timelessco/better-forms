import type * as React from "react";
import { useCallback, useRef } from "react";

export const RIGHT_SIDEBAR_WIDTH_MIN = 280;
export const RIGHT_SIDEBAR_WIDTH_DEFAULT = 340;
export const RIGHT_SIDEBAR_WIDTH_MAX = 420;
export const RIGHT_SIDEBAR_WIDTH_KEY = "right_sidebar_width";

export const RightSidebarResizeHandle = ({
  sidebarWidth,
  setSidebarWidth,
  setIsResizing,
}: {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  setIsResizing: (v: boolean) => void;
}) => {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = sidebarWidth;
      setIsResizing(true);
      Object.assign(document.body.style, {
        cursor: "col-resize",
        userSelect: "none",
      });

      const handleMouseMove = (evt: MouseEvent) => {
        // For right sidebar, dragging left increases width
        const delta = startXRef.current - evt.clientX;
        setSidebarWidth(startWidthRef.current + delta);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        Object.assign(document.body.style, {
          cursor: "",
          userSelect: "",
        });
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [sidebarWidth, setSidebarWidth, setIsResizing],
  );

  const handleDoubleClick = useCallback(() => {
    setSidebarWidth(RIGHT_SIDEBAR_WIDTH_DEFAULT);
  }, [setSidebarWidth]);

  // Latest sidebarWidth in a ref so the callback doesn't depend on it (parent setter takes a number, not an updater).
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 50 : 10;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSidebarWidth(sidebarWidthRef.current + step);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setSidebarWidth(sidebarWidthRef.current - step);
      }
    },
    [setSidebarWidth],
  );

  return (
    <div
      role="separator"
      aria-label="Resize sidebar"
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      className="fixed top-0 bottom-0 z-50 w-0 cursor-col-resize after:absolute after:inset-y-0 after:-left-[2px] after:w-[5px] after:content-[''] hover:after:bg-sidebar-border/50 active:after:bg-sidebar-border"
      style={{ right: `${sidebarWidth}px` }}
    />
  );
};
