import { animate, useMotionValue, useTransform } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { useControllableState } from "@/hooks/use-controllable-state/use-controllable-state";

// Drag detection & rubber band
const CLICK_THRESHOLD = 3;
const DEAD_ZONE = 32;
const MAX_CURSOR_RANGE = 200;
const MAX_STRETCH = 8;

// Layout offsets used by the "handle dodges value text" calculation.
const HANDLE_BUFFER = 8;
const VALUE_OFFSET = 12 - 8;

// Width of the hidden "auto" zone reserved at the left edge when allowAuto.
const AUTO_SLOT_PERCENT = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type InteractionState = {
  isInteracting: boolean;
  isDragging: boolean;
  isHovered: boolean;
  /** Ring only for Tab focus or keyboard value nudges, not pointer press/drag. */
  keyboardFocusRing: boolean;
};

type InteractionAction =
  | { type: "pointer-down" }
  | { type: "pointer-up" }
  | { type: "drag-start" }
  | { type: "hover-enter" }
  | { type: "hover-leave" }
  | { type: "keyboard-focus" }
  | { type: "track-blur" };

const initialInteractionState: InteractionState = {
  isInteracting: false,
  isDragging: false,
  isHovered: false,
  keyboardFocusRing: false,
};

const interactionReducer = (
  state: InteractionState,
  action: InteractionAction,
): InteractionState => {
  switch (action.type) {
    case "pointer-down":
      return { ...state, isInteracting: true, keyboardFocusRing: false };
    case "pointer-up":
      return { ...state, isInteracting: false, isDragging: false };
    case "drag-start":
      return { ...state, isDragging: true };
    case "hover-enter":
      return { ...state, isHovered: true };
    case "hover-leave":
      return { ...state, isHovered: false };
    case "keyboard-focus":
      return { ...state, keyboardFocusRing: true };
    case "track-blur":
      return { ...state, keyboardFocusRing: false };
    default:
      return state;
  }
};

const decimalsForStep = (step: number): number => {
  const s = step.toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
};

const roundValue = (val: number, step: number): number => {
  const raw = Math.round(val / step) * step;
  return Number.parseFloat(raw.toFixed(decimalsForStep(step)));
};

// Magnetic snap to the nearest decile when within 3.125% of it.
const snapToDecile = (rawValue: number, min: number, max: number): number => {
  const normalized = (rawValue - min) / (max - min);
  const nearest = Math.round(normalized * 10) / 10;
  if (Math.abs(normalized - nearest) <= 0.03125) {
    return min + nearest * (max - min);
  }
  return rawValue;
};

export interface UseElasticSliderOptions {
  label: string;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min: number;
  max: number;
  step: number;
  formatValue?: (value: number) => string;
  allowAuto: boolean;
  isAuto: boolean;
  onAutoChange?: () => void;
  shouldReduceMotion: boolean | null;
  /** "dot" turns the hash marks into discrete snap stops the handle locks onto. */
  markStyle: "line" | "dot";
}

export const useElasticSlider = ({
  label,
  value: valueProp,
  defaultValue,
  onValueChange,
  min,
  max,
  step,
  formatValue,
  allowAuto,
  isAuto,
  onAutoChange,
  shouldReduceMotion,
  markStyle,
}: UseElasticSliderOptions) => {
  const hasAutoSlot = allowAuto && typeof onAutoChange === "function";
  const slotOffset = hasAutoSlot ? AUTO_SLOT_PERCENT : 0;
  const numericTrackPercent = 100 - slotOffset;
  const [value = min, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue ?? min,
    onChange: onValueChange,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  const [interaction, dispatchInteraction] = useReducer(
    interactionReducer,
    initialInteractionState,
  );
  const { isInteracting, isDragging, isHovered, keyboardFocusRing } = interaction;

  // Pointer session state — mutable, does not trigger re-renders.
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const pendingPointerFocusRef = useRef(false);
  const isClickRef = useRef(true);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);
  const wrapperRectRef = useRef<DOMRect | null>(null);
  const scaleRef = useRef(1);

  const percentage = isAuto ? 0 : slotOffset + ((value - min) / (max - min)) * numericTrackPercent;
  const isActive = isInteracting || isHovered;
  const displayValue = formatValue ? formatValue(value) : value.toFixed(decimalsForStep(step));

  // Fill + handle driven by a single motion value for imperative updates.
  const fillPercent = useMotionValue(percentage);
  // Figma: the fill tile never collapses behind the label — min width = label end + handle
  // clearance (measured below). Auto (pct 0) still collapses to nothing; handle parks at 2px.
  const minFillPx = useMotionValue(0);
  const fillWidth = useTransform(() =>
    fillPercent.get() <= 0.01 ? "0%" : `max(${fillPercent.get()}%, ${minFillPx.get()}px)`,
  );
  const handleLeft = useTransform(() =>
    fillPercent.get() <= 0.01
      ? "2px"
      : `calc(max(${fillPercent.get()}%, ${minFillPx.get()}px) - 10px)`,
  );

  // Rubber band: widens the track and pulls it left when dragged past bounds.
  const rubberStretch = useMotionValue(0);
  const rubberWidth = useTransform(rubberStretch, (s) => `calc(100% + ${Math.abs(s)}px)`);
  const rubberX = useTransform(rubberStretch, (s) => (s < 0 ? s : 0));

  // Sync from props when not interacting and no spring is in flight.
  useEffect(() => {
    if (!isInteracting && !animRef.current) {
      fillPercent.jump(percentage);
    }
  }, [percentage, isInteracting, fillPercent]);

  const positionToState = useCallback(
    (clientX: number): { kind: "auto" } | { kind: "value"; value: number } => {
      const rect = wrapperRectRef.current;
      if (!rect) return { kind: "value", value: min };

      const sceneX = (clientX - rect.left) / scaleRef.current;
      const nativeWidth = wrapperRef.current?.offsetWidth ?? rect.width;
      const percent = clamp(sceneX / nativeWidth, 0, 1);

      if (hasAutoSlot && percent <= AUTO_SLOT_PERCENT / 100) {
        return { kind: "auto" };
      }

      const numericPct = hasAutoSlot
        ? clamp((percent - AUTO_SLOT_PERCENT / 100) / (1 - AUTO_SLOT_PERCENT / 100), 0, 1)
        : percent;

      return {
        kind: "value",
        value: clamp(min + numericPct * (max - min), min, max),
      };
    },
    [min, max, hasAutoSlot],
  );

  const percentFromValue = useCallback(
    (v: number) => slotOffset + ((v - min) / (max - min)) * numericTrackPercent,
    [min, max, slotOffset, numericTrackPercent],
  );

  // Dot variant: the marks ARE the snap stops. Place ~7 interior stops (Figma Radius) at a whole
  // number of steps (clean increments) and snap the value to the nearest of {min, …stops, max}.
  // Rendering reads the same list, so a dot always sits exactly where the handle can land.
  const markStops = useMemo(() => {
    if (markStyle !== "dot") return null;
    const range = max - min;
    if (range <= 0) return [];
    const interval = Math.max(step, Math.round(range / 8 / step) * step);
    const interior: number[] = [];
    for (let v = min + interval; v < max - 1e-9; v += interval) {
      interior.push(roundValue(v, step));
    }
    return interior;
  }, [markStyle, min, max, step]);

  const snapToMark = useCallback(
    (v: number): number => {
      if (!markStops) return v;
      const stops = [min, ...markStops, max];
      return stops.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), stops[0]);
    },
    [markStops, min, max],
  );

  // Animate fill to target percent; jump instantly under reduced motion (position still updates, only spring skipped).
  const animateFillTo = useCallback(
    (targetPercent: number) => {
      animRef.current?.stop();

      if (shouldReduceMotion) {
        fillPercent.jump(targetPercent);
        animRef.current = null;
        return;
      }

      animRef.current = animate(fillPercent, targetPercent, {
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.8,
        onComplete: () => {
          animRef.current = null;
        },
      });
    },
    [fillPercent, shouldReduceMotion],
  );

  const computeRubberStretch = useCallback((clientX: number, sign: number) => {
    const rect = wrapperRectRef.current;
    if (!rect) return 0;

    const distancePast = sign < 0 ? rect.left - clientX : clientX - rect.right;
    const overflow = Math.max(0, distancePast - DEAD_ZONE);

    return sign * MAX_STRETCH * Math.sqrt(Math.min(overflow / MAX_CURSOR_RANGE, 1));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    pointerDownPos.current = { x: e.clientX, y: e.clientY };

    isClickRef.current = true;

    dispatchInteraction({ type: "pointer-down" });

    pendingPointerFocusRef.current = true;

    // Move focus to slider so subsequent keyboard input lands and focus styles match active state.
    trackRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      pendingPointerFocusRef.current = false;
    });

    // Snapshot the wrapper rect so later math is immune to layout shifts.
    const wrapper = wrapperRef.current;
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      wrapperRectRef.current = rect;
      scaleRef.current = rect.width / wrapper.offsetWidth;
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isInteracting || !pointerDownPos.current) return;

      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;

      if (isClickRef.current && Math.hypot(dx, dy) > CLICK_THRESHOLD) {
        isClickRef.current = false;
        dispatchInteraction({ type: "drag-start" });
      }

      if (isClickRef.current) return;

      const rect = wrapperRectRef.current;
      if (rect && !shouldReduceMotion) {
        if (e.clientX < rect.left) {
          rubberStretch.jump(computeRubberStretch(e.clientX, -1));
        } else if (e.clientX > rect.right) {
          rubberStretch.jump(computeRubberStretch(e.clientX, 1));
        } else {
          rubberStretch.jump(0);
        }
      }

      const next = positionToState(e.clientX);
      animRef.current?.stop();
      animRef.current = null;

      if (next.kind === "auto") {
        fillPercent.jump(0);
        onAutoChange?.();
      } else {
        fillPercent.jump(percentFromValue(next.value));
        setValue(roundValue(next.value, step));
      }
    },
    [
      isInteracting,
      positionToState,
      percentFromValue,
      setValue,
      step,
      fillPercent,
      rubberStretch,
      computeRubberStretch,
      shouldReduceMotion,
      onAutoChange,
    ],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isInteracting) return;

      const next = positionToState(e.clientX);
      if (next.kind === "auto") {
        if (isClickRef.current) {
          animateFillTo(0);
          onAutoChange?.();
        }
      } else if (markStops) {
        // Dot variant: land on the nearest snap stop whether the gesture was a click or a drag.
        const snapped = snapToMark(next.value);
        animateFillTo(percentFromValue(snapped));
        setValue(roundValue(snapped, step));
      } else if (isClickRef.current) {
        // Coarse sliders (≤10 positions) snap to nearest step; continuous ones keep decile-magnetic.
        const discreteSteps = (max - min) / step;
        const snapped =
          discreteSteps <= 10
            ? clamp(min + Math.round((next.value - min) / step) * step, min, max)
            : snapToDecile(next.value, min, max);

        animateFillTo(percentFromValue(snapped));
        setValue(roundValue(snapped, step));
      }

      if (!shouldReduceMotion && rubberStretch.get() !== 0) {
        animate(rubberStretch, 0, {
          type: "spring",
          visualDuration: 0.25,
          bounce: 0.15,
        });
      }

      dispatchInteraction({ type: "pointer-up" });
      pointerDownPos.current = null;
    },
    [
      isInteracting,
      positionToState,
      percentFromValue,
      setValue,
      min,
      max,
      step,
      animateFillTo,
      rubberStretch,
      shouldReduceMotion,
      onAutoChange,
      markStops,
      snapToMark,
    ],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Shift+Arrow: Figma-style fast nudge, 10x step (independent of WAI-ARIA Page step which scales with range).
      const arrowStep = e.shiftKey ? step * 10 : step;

      // In auto, base from min so ArrowUp lands on `min + step`, not overshoot.
      const baseValue = isAuto ? min : value;

      let next: number | null = null;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = baseValue + arrowStep;
          break;

        case "ArrowLeft":
        case "ArrowDown":
          next = baseValue - arrowStep;
          break;

        case "Home":
          next = min;
          break;

        case "End":
          next = max;
          break;

        default:
          return;
      }

      e.preventDefault();

      dispatchInteraction({ type: "keyboard-focus" });

      const snapped = roundValue(clamp(next, min, max), step);
      animateFillTo(percentFromValue(snapped));
      setValue(snapped);
    },
    [value, isAuto, min, max, step, animateFillTo, percentFromValue, setValue],
  );

  const handleTrackFocus = useCallback(() => {
    if (!pendingPointerFocusRef.current) {
      dispatchInteraction({ type: "keyboard-focus" });
    }
  }, []);

  const handleTrackBlur = useCallback(() => {
    dispatchInteraction({ type: "track-blur" });
  }, []);

  const handleMouseEnter = useCallback(() => {
    dispatchInteraction({ type: "hover-enter" });
  }, []);

  const handleMouseLeave = useCallback(() => {
    dispatchInteraction({ type: "hover-leave" });
  }, []);

  // Measure label + value: min fill clamp (tile ≥ label + clearance, Figma) and the right-side
  // dodge threshold so the handle fades when it would sit under the value text.
  const [dodge, setDodge] = useState({ right: 72 });

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const measure = () => {
      const trackWidth = wrapper.offsetWidth;
      if (trackWidth <= 0) return;

      const labelEl = labelRef.current;
      const valueEl = valueRef.current;

      // Figma 25441:4643 — label ends, 14px gap, 2px handle, 8px tile padding ⇒ +24.
      if (labelEl) minFillPx.set(labelEl.offsetLeft + labelEl.offsetWidth + 24);

      const right = valueEl
        ? ((trackWidth - VALUE_OFFSET - valueEl.offsetWidth - HANDLE_BUFFER) / trackWidth) * 100
        : 72;

      setDodge((prev) => (prev.right === right ? prev : { right }));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);

    if (labelRef.current) observer.observe(labelRef.current);
    if (valueRef.current) observer.observe(valueRef.current);

    return () => observer.disconnect();
  }, [label, displayValue, minFillPx]);

  const valueDodge = percentage > dodge.right;
  // Figma rest states: handle always visible inside the tile; faint 2px sliver at the left edge
  // in Auto; fades only when it would collide with the value text.
  const handleOpacity = isAuto ? 0.35 : valueDodge ? 0.15 : 1;

  const discreteSteps = (max - min) / step;
  const hashMarkCount = discreteSteps <= 10 ? discreteSteps - 1 : 9;

  const hashMarkPct = useCallback(
    (i: number) => {
      const rawPct = discreteSteps <= 10 ? (((i + 1) * step) / (max - min)) * 100 : (i + 1) * 10;
      return slotOffset + (rawPct * numericTrackPercent) / 100;
    },
    [discreteSteps, max, min, step, slotOffset, numericTrackPercent],
  );

  // Dot variant: render a dot per snap stop, hiding the one the handle is currently on/nearest so the
  // handle never collides with a dot (matches the Figma filled states).
  const dotMarks = useMemo(() => {
    if (!markStops) return null;
    const hideWithin = markStops.length > 0 ? 100 / (markStops.length + 1) / 2 : 5;
    return markStops.map((v) => {
      const pct = percentFromValue(v);
      return { pct, hidden: Math.abs(pct - percentage) < hideWithin };
    });
  }, [markStops, percentFromValue, percentage]);

  return {
    wrapperRef,
    trackRef,
    labelRef,
    valueRef,
    value,
    displayValue,
    isActive,
    isDragging,
    keyboardFocusRing,
    valueDodge,
    handleOpacity,
    hashMarkCount,
    hashMarkPct,
    dotMarks,
    fillWidth,
    handleLeft,
    rubberWidth,
    rubberX,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onFocus: handleTrackFocus,
      onBlur: handleTrackBlur,
      onKeyDown: handleKeyDown,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
  };
};
