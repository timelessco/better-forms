import { useCallback, useEffect, useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { motion, AnimatePresence } from "motion/react";
import { XIcon } from "@/components/ui/icons";
import { iconMap } from "@/components/icon-picker/icon-data";
import { SPRITE_PATH } from "@/lib/config/app-config";
import { isValidUrl } from "@/lib/utils";
import type { EmbedType } from "@/hooks/use-editor-sidebar";

interface EmbedPreviewMockupProps {
  embedType: EmbedType;
  popupPosition?: "bottom-right" | "bottom-left" | "center";
  darkOverlay?: boolean;
  emoji?: boolean;
  emojiIcon?: string;
  alignLeft?: boolean;
}

const MORPH_SPRING = { type: "spring" as const, stiffness: 400, damping: 30 };
const INSTANT = { duration: 0 };
const FADE_TRANSITION = { duration: 0.2 };

const PAD = 16;

type IconDisplay =
  | { type: "image"; value: string }
  | { type: "emoji"; value: string }
  | { type: "sprite"; value: string }
  | null;

const resolveIconDisplay = (emoji: boolean, emojiIcon: string | undefined): IconDisplay => {
  if (!emoji) return null;
  const icon = (emojiIcon || "").trim();
  if (!icon) return null;
  if (isValidUrl(icon)) return { type: "image", value: icon };
  if (iconMap.has(icon)) return { type: "sprite", value: icon };
  // Short string likely emoji (e.g. 👋)
  if (icon.length <= 4) return { type: "emoji", value: icon };
  return null;
};

const PopupIconContent = ({ display }: { display: IconDisplay }) => {
  const [imageError, setImageError] = useState(false);
  const handleImageError = useCallback(() => setImageError(true), []);
  if (!display) return null;
  if (display.type === "image") {
    if (imageError) return null;
    return (
      <img
        src={display.value}
        alt=""
        className="absolute inset-0 size-full object-contain"
        onError={handleImageError}
      />
    );
  }
  if (display.type === "emoji") {
    return (
      <span className="absolute inset-0 flex items-center justify-center bg-muted text-[14px] text-muted">
        {display.value}
      </span>
    );
  }
  if (display.type === "sprite") {
    return (
      <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
        <svg className="size-[14px]" fill="currentColor" viewBox="0 0 24 24">
          <use href={`${SPRITE_PATH}#${display.value}`} />
        </svg>
      </span>
    );
  }
  return null;
};

const getTargetStyle = (
  embedType: EmbedType,
  popupPosition: string,
  isPopupExpanded: boolean,
  cw: number,
  ch: number,
  alignLeft?: boolean,
) => {
  switch (embedType) {
    case "standard": {
      const w = alignLeft ? cw * 0.65 : cw - 16;
      return {
        left: PAD + 8,
        top: PAD + (ch - 64) / 2,
        width: w,
        height: 64,
        borderRadius: 12,
      };
    }
    case "fullpage":
      return {
        left: PAD,
        top: PAD,
        width: cw,
        height: ch,
        borderRadius: 12,
      };
    case "popup": {
      if (isPopupExpanded) {
        const w = 74;
        const h = 96;
        const pos = getCornerPos(popupPosition, cw, ch, w, h);
        return { ...pos, width: w, height: h, borderRadius: 12 };
      }
      const size = 28;
      const pos = getCornerPos(popupPosition, cw, ch, size, size);
      return { ...pos, width: size, height: size, borderRadius: size / 2 };
    }
  }
};

const getCornerPos = (position: string, cw: number, ch: number, w: number, h: number) => {
  switch (position) {
    case "bottom-left":
      return { left: PAD, top: PAD + ch - h };
    case "center":
      return { left: PAD + (cw - w) / 2, top: PAD + (ch - h) / 2 };
    case "bottom-right":
    default:
      return { left: PAD + cw - w, top: PAD + ch - h };
  }
};

// Get the bubble position (always in the corner, even when popup is expanded at center)
const getBubblePos = (position: string, cw: number, ch: number) => {
  const size = 28;
  switch (position) {
    case "bottom-left":
      return { left: PAD, top: PAD + ch - size };
    case "center":
      return { left: PAD + cw - size, top: PAD + ch - size }; // default to bottom-right for bubble
    case "bottom-right":
    default:
      return { left: PAD + cw - size, top: PAD + ch - size };
  }
};

export const EmbedPreviewMockup = ({
  embedType = "fullpage",
  popupPosition = "bottom-right",
  darkOverlay = false,
  emoji = true,
  emojiIcon = "👋",
  alignLeft = false,
}: EmbedPreviewMockupProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [isPopupExpanded, setIsPopupExpanded] = useState(false);
  const hasAnimated = useRef(false);
  const isResizing = useRef(false);

  // Measure content area — only re-measure on resize for fullpage
  useIsomorphicLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let initialMeasure = true;
    const measure = () => {
      if (!initialMeasure) {
        if (embedType !== "fullpage") return;
        isResizing.current = true;
      }
      initialMeasure = false;
      setSize({
        w: el.clientWidth - 32,
        h: el.clientHeight - 32,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedType]);

  // Auto-expand popup after 2s when in popup mode
  useEffect(() => {
    if (embedType !== "popup") return;
    const timer = setTimeout(() => setIsPopupExpanded(true), 2000);
    return () => clearTimeout(timer);
  }, [embedType]);

  const target =
    size.w > 0
      ? getTargetStyle(embedType, popupPosition, isPopupExpanded, size.w, size.h, alignLeft)
      : null;

  let transition;
  if (!hasAnimated.current || isResizing.current) {
    transition = INSTANT;
  } else {
    transition = MORPH_SPRING;
  }

  const handleAnimationComplete = useCallback(() => {
    hasAnimated.current = true;
    isResizing.current = false;
  }, []);

  const handleMouseEnterMorph = useCallback(() => {
    if (isPopupExpanded) return;
    setIsPopupExpanded(true);
  }, [isPopupExpanded]);

  const handleMouseLeaveMorph = useCallback(() => {
    setIsPopupExpanded(false);
  }, []);

  const handleCloseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPopupExpanded(false);
  }, []);

  const handleBubbleMouseEnter = useCallback(() => setIsPopupExpanded(true), []);
  const handleBubbleClick = useCallback(() => setIsPopupExpanded(true), []);

  const bubblePos = size.w > 0 ? getBubblePos(popupPosition, size.w, size.h) : null;
  const isPopup = embedType === "popup";
  const popupIconDisplay = resolveIconDisplay(emoji, emojiIcon);

  return (
    <div className="overflow-hidden rounded-[12px] bg-secondary">
      <div className="flex items-center gap-1 px-2.25 pt-2.5 pb-2">
        <div className="flex gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
        </div>
      </div>

      <div ref={contentRef} className="relative h-[160px] overflow-hidden p-4">
        <AnimatePresence mode="sync">
          {embedType === "standard" && (
            <motion.div
              key="standard-bg"
              className="absolute inset-4 flex flex-col justify-center gap-4 py-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FADE_TRANSITION}
            >
              <div className="space-y-2 px-2 opacity-30">
                <div className="h-2 w-1/4 rounded-full bg-muted" />
                <div className="h-1.5 w-full rounded-full bg-muted" />
                <div className="h-1.5 w-4/5 rounded-full bg-muted" />
              </div>
              <div className="h-16" />
              <div className="space-y-2 px-2 opacity-10">
                <div className="h-1.5 w-full rounded-full bg-muted" />
                <div className="h-1.5 w-11/12 rounded-full bg-muted" />
              </div>
            </motion.div>
          )}
          {embedType === "popup" && (
            <motion.div
              key="popup-bg"
              className="absolute inset-4 space-y-3 pt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              exit={{ opacity: 0 }}
              transition={FADE_TRANSITION}
            >
              <div className="h-2.5 w-1/5 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-2 w-full rounded-full bg-muted" />
                <div className="h-2 w-full rounded-full bg-muted" />
                <div className="h-2 w-3/4 rounded-full bg-muted" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isPopup && darkOverlay && isPopupExpanded && (
            <motion.div
              key="dark-overlay"
              className="absolute inset-0 z-10 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FADE_TRANSITION}
            />
          )}
        </AnimatePresence>

        {target && (
          <motion.div
            className="absolute z-20 overflow-hidden bg-muted shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
            animate={target}
            transition={transition}
            onAnimationComplete={handleAnimationComplete}
            onMouseEnter={isPopup ? handleMouseEnterMorph : undefined}
            onMouseLeave={isPopup ? handleMouseLeaveMorph : undefined}
          >
            {isPopup && isPopupExpanded && (
              <button
                type="button"
                aria-label="Close preview"
                className="absolute top-1 right-1 z-30 flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full bg-muted-foreground/10 transition-colors hover:bg-muted-foreground/20"
                onClick={handleCloseClick}
              >
                <XIcon className="h-2 w-2 text-muted-foreground" />
              </button>
            )}

            <AnimatePresence>
              {isPopup && !isPopupExpanded && popupIconDisplay && (
                <motion.span
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.15 }}
                >
                  <PopupIconContent display={popupIconDisplay} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Separate bubble trigger (visible when popup is collapsed & no emoji) */}
        {isPopup && !isPopupExpanded && !emoji && bubblePos && (
          <button
            type="button"
            aria-label="Open popup preview"
            className="absolute z-20 h-[28px] w-[28px] cursor-pointer rounded-full bg-[#e0e0e0] p-0 shadow-[0_2px_10px_rgba(0,0,0,0.04)] dark:bg-card"
            style={{ left: bubblePos.left, top: bubblePos.top }}
            onMouseEnter={handleBubbleMouseEnter}
            onClick={handleBubbleClick}
          />
        )}
      </div>
    </div>
  );
};
