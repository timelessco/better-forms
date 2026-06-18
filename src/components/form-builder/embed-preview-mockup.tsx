import { useCallback, useEffect, useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { motion, AnimatePresence } from "motion/react";
import { SPRITE_PATH } from "@/lib/config/app-config";
import { cn, isValidUrl } from "@/lib/utils";
import type { EmbedType } from "@/hooks/use-editor-sidebar";
import { useResolvedTheme } from "@/components/theme-provider";
import { useFormCustomization } from "@/hooks/use-form-customization";

interface EmbedPreviewMockupProps {
  embedType: EmbedType;
  popupPosition?: "bottom-right" | "bottom-left" | "center";
  darkOverlay?: boolean;
  emojiIcon?: string;
  alignLeft?: boolean;
  customization?: Record<string, string> | null;
}

const MORPH_SPRING = { type: "spring" as const, stiffness: 400, damping: 30 };
const INSTANT = { duration: 0 };
const FADE_TRANSITION = { duration: 0.2 };

// 8px corner gap — Figma 25363-20771: the popup card/bubble sit 8px from the frame edges.
const PAD = 8;

type IconDisplay =
  | { type: "image"; value: string }
  | { type: "emoji"; value: string }
  | { type: "sprite"; value: string }
  | null;

const resolveIconDisplay = (emojiIcon: string | undefined): IconDisplay => {
  const icon = (emojiIcon || "").trim();
  if (!icon) return null;
  if (isValidUrl(icon)) return { type: "image", value: icon };
  // Short strings = emoji; longer = sprite names. Sprite has more than `iconMap`, so don't gate on `iconMap.has`.
  if (icon.length <= 4) return { type: "emoji", value: icon };
  return { type: "sprite", value: icon };
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
      <span className="absolute inset-0 flex items-center justify-center bg-input text-[14px] text-muted">
        {display.value}
      </span>
    );
  }
  if (display.type === "sprite") {
    return (
      <span className="absolute inset-0 flex items-center justify-center">
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
      // Embedded iframe: a narrow, tall form panel inset on the left edge of the host page; the
      // page's own copy flows full-width above and below it (see Figma 26068-6831). alignLeft keeps
      // it pinned left; otherwise nudge it slightly in from the edge.
      return {
        left: PAD + (alignLeft ? 0 : 6),
        top: PAD + ch * 0.2,
        width: cw * 0.3,
        height: ch * 0.58,
        borderRadius: 8,
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
        // Figma popup card (node 25300-…): 8px radius — keep the card corners tight, not pill-soft.
        return { ...pos, width: w, height: h, borderRadius: 8 };
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

// Bubble position; always in corner, even when popup expands at center.
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

// Static embed (standard) preview — faithful to Figma node 26075-12773 (browser-frame skeleton).
// The standard case is a flat skeleton (no morph), so exact px spacing beats the ratio-positioned
// mockup: 10px frame padding, 8px dots (4px gap), 10px below dots, 7px between bar-groups + the block.
// Tokens map 1:1 to Figma — bg-secondary=gray/100, bg-input=gray/300 (dots+block), bg-gray-200=gray/200 (bars).
export const EmbedStandardPreview = () => (
  <div className="overflow-hidden rounded-[12px] bg-secondary p-2.5">
    <div className="flex gap-1">
      <div className="size-2 rounded-full bg-input" />
      <div className="size-2 rounded-full bg-input" />
      <div className="size-2 rounded-full bg-input" />
    </div>
    <div className="mt-2.5 flex flex-col gap-[7px]">
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 w-[60px] max-w-full rounded-lg bg-gray-200" />
        <div className="h-1.5 w-[224px] max-w-full rounded-lg bg-gray-200" />
      </div>
      <div className="h-20 w-[70px] rounded-lg bg-input" />
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 w-[185px] max-w-full rounded-lg bg-gray-200" />
        <div className="h-1.5 w-[138px] max-w-full rounded-lg bg-gray-200" />
      </div>
    </div>
  </div>
);

// Static full-page preview — faithful to Figma node 26068-6990. The page form is one block filling
// the frame: 10px frame padding, 8px dots, 10px below dots, then a 244×128 gray-300 block (12px L/R/B
// margins via mx/mb-0.5, radius 8). bg-input=gray/300 (dots+block), bg-secondary=gray/100 (frame).
export const EmbedFullPagePreview = () => (
  <div className="overflow-hidden rounded-[12px] bg-secondary p-2.5">
    <div className="flex gap-1">
      <div className="size-2 rounded-full bg-input" />
      <div className="size-2 rounded-full bg-input" />
      <div className="size-2 rounded-full bg-input" />
    </div>
    <div className="mx-0.5 mt-2.5 mb-0.5 h-32 rounded-lg bg-input" />
  </div>
);

export const EmbedPreviewMockup = ({
  embedType = "fullpage",
  popupPosition = "bottom-right",
  darkOverlay = false,
  emojiIcon = "👋",
  alignLeft = false,
  customization: rawCustomization,
}: EmbedPreviewMockupProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const resolvedAppTheme = useResolvedTheme();
  const { themeVars, hasCustomization } = useFormCustomization(
    rawCustomization ? { customization: rawCustomization } : null,
    resolvedAppTheme,
  );
  // Popup preview opens expanded first, then auto-collapses to its bubble (see effect below).
  const [isPopupExpanded, setIsPopupExpanded] = useState(true);
  const hasAnimated = useRef(false);
  const isResizing = useRef(false);

  // Measure content area; re-measure on resize for every type so the popup bubble/card
  // stays pinned to its corner (corner = PAD + cw - w, which drifts if cw goes stale).
  useIsomorphicLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let initialMeasure = true;
    const measure = () => {
      // Snap repositions instantly (no morph spring) while the container resizes.
      if (!initialMeasure) isResizing.current = true;
      initialMeasure = false;
      setSize({
        w: el.clientWidth - PAD * 2,
        h: el.clientHeight - PAD * 2,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedType]);

  // Open expanded first, then auto-collapse to the bubble after 2s when in popup mode.
  useEffect(() => {
    if (embedType !== "popup") return;
    setIsPopupExpanded(true);
    const timer = setTimeout(() => setIsPopupExpanded(false), 2000);
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

  const handleBubbleMouseEnter = useCallback(() => setIsPopupExpanded(true), []);
  const handleBubbleClick = useCallback(() => setIsPopupExpanded(true), []);

  const bubblePos = size.w > 0 ? getBubblePos(popupPosition, size.w, size.h) : null;
  const isPopup = embedType === "popup";
  const popupIconDisplay = resolveIconDisplay(emojiIcon);

  // At-rest bubble = icon-picker-preview form-logo style: a bg-card surface chip with a foreground
  // glyph (themed via bf-themed when customized). Avoids bg-primary, whose glyph is text-primary-
  // foreground — but `.bf-themed` force-sets `color: --bf-foreground`, so on a #212121 primary the
  // light-mode glyph collapses to the same color and vanishes. bg-card/foreground always contrast.
  const atRestBubble = isPopup && !isPopupExpanded;
  let bubbleSurfaceClass = "bg-input";
  if (atRestBubble) {
    bubbleSurfaceClass = hasCustomization
      ? "bf-themed bg-card text-foreground"
      : "bg-card text-foreground";
  }

  return (
    <div className="flex h-[168px] flex-col overflow-hidden rounded-[12px] bg-secondary">
      <div className="flex items-center gap-1 px-2.25 pt-2.5 pb-2">
        <div className="flex gap-1">
          <div className="size-2 rounded-full bg-input" />
          <div className="size-2 rounded-full bg-input" />
          <div className="size-2 rounded-full bg-input" />
        </div>
      </div>

      <div ref={contentRef} className="relative flex-1 overflow-hidden p-4">
        <AnimatePresence mode="sync">
          {embedType === "standard" && (
            <motion.div
              key="standard-bg"
              // top-0.5 (not inset-4 top): host copy sits ~28px below the container top, matching Figma's tight gap under the dots.
              className="absolute inset-x-4 top-0.5 bottom-4 flex flex-col justify-between"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FADE_TRANSITION}
            >
              {/* Host-page copy above the embed. Figma skeleton bars = solid gray-200 (#ededed). */}
              <div className="space-y-1.5">
                <div className="h-1.5 w-1/4 rounded-full bg-gray-200" />
                <div className="h-1.5 w-[92%] rounded-full bg-gray-200" />
              </div>
              {/* Host-page copy below the embed. */}
              <div className="space-y-1.5">
                <div className="h-1.5 w-3/4 rounded-full bg-gray-200" />
                <div className="h-1.5 w-[56%] rounded-full bg-gray-200" />
              </div>
            </motion.div>
          )}
          {/* Figma popup mockup (node 25363-20471) is just the dots + the popup card — no host skeleton lines. */}
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
            className={cn(
              "absolute z-20 overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.04)]",
              bubbleSurfaceClass,
            )}
            style={atRestBubble && hasCustomization ? themeVars : undefined}
            animate={target}
            transition={transition}
            onAnimationComplete={handleAnimationComplete}
            onMouseEnter={isPopup ? handleMouseEnterMorph : undefined}
            onMouseLeave={isPopup ? handleMouseLeaveMorph : undefined}
          >
            {/* Fullpage = the form fills the whole host page: a single solid panel filling the
                browser viewport (see Figma 26068-6990). No inner chrome — the morph box itself is
                the panel. */}

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

        {/* Fallback bubble when no resolvable icon; same corner as morph target. Renders only if icon overlay would be empty. */}
        {isPopup && !isPopupExpanded && !popupIconDisplay && bubblePos && (
          <button
            type="button"
            aria-label="Open popup preview"
            className={cn(
              "absolute z-20 size-[28px] cursor-pointer rounded-full p-0 shadow-[0_2px_10px_rgba(0,0,0,0.04)]",
              hasCustomization
                ? "bf-themed bg-primary text-primary-foreground"
                : "bg-[#e0e0e0] dark:bg-card",
            )}
            style={{
              left: bubblePos.left,
              top: bubblePos.top,
              ...(hasCustomization ? themeVars : undefined),
            }}
            onMouseEnter={handleBubbleMouseEnter}
            onClick={handleBubbleClick}
          />
        )}
      </div>
    </div>
  );
};
