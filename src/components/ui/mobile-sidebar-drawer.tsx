import { animate, domAnimation, LazyMotion, m, useMotionValue, useTransform } from "motion/react";
import { useEffect, useEffectEvent, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  classifyDirection,
  estimateVelocity,
  pushSample,
  SPRING_CONFIG,
} from "@/lib/swipe-gesture";
import type { GestureLock, VelocitySample } from "@/lib/swipe-gesture";

/**
 * Left mobile drawer with swipe-from-anywhere gestures. On Motion primitives (not Vaul) for:
 *   1. Pan from anywhere — document-level touchmove with direction-lock claims horizontal
 *      rightward pans, yields to vertical scrolls.
 *   2. 1:1 finger tracking — x-transform is a MotionValue fed `clientX - startX`, no interpolation.
 *   3. Velocity-aware release with spring physics.
 * iOS Safari reserves the first ~18px for its back gesture; touchstarts there are ignored.
 */

const DRAWER_WIDTH_REM = 18;
const DRAWER_WIDTH_PX = DRAWER_WIDTH_REM * 16;
const EDGE_IGNORE_PX = 18;
const OPEN_VELOCITY_THRESHOLD = 500;
const OPEN_DISPLACEMENT_RATIO = 0.4;

interface MobileSidebarDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

interface GestureState {
  startX: number;
  startY: number;
  startedOpen: boolean;
  lock: GestureLock;
  dragging: boolean;
  samples: VelocitySample[];
}

const freshGesture = (): GestureState => ({
  startX: 0,
  startY: 0,
  startedOpen: false,
  lock: null,
  dragging: false,
  samples: [],
});

export const MobileSidebarDrawer = ({
  open,
  onOpenChange,
  children,
  className,
}: MobileSidebarDrawerProps) => {
  const x = useMotionValue(open ? 0 : -DRAWER_WIDTH_PX);
  const overlayOpacity = useTransform(x, [-DRAWER_WIDTH_PX, 0], [0, 0.5]);
  const gestureRef = useRef<GestureState>(freshGesture());
  // Mirror latest `open` for long-lived touch handlers without re-attaching on each toggle.
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (gestureRef.current.dragging) return;
    animate(x, open ? 0 : -DRAWER_WIDTH_PX, SPRING_CONFIG);
  }, [open, x]);

  const notifyOpenChange = useEffectEvent((next: boolean) => onOpenChange(next));

  useEffect(() => {
    // touchmove attached lazily (only during a gesture) so passive-scroll isn't disabled page-wide.
    let moveAttached = false;

    const attachMove = () => {
      if (moveAttached) return;
      // eslint-disable-next-line react-doctor/client-passive-event-listeners -- handler intentionally calls preventDefault to suppress page scroll during drawer drag; passive listeners would silently ignore preventDefault
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      moveAttached = true;
    };
    const detachMove = () => {
      if (!moveAttached) return;
      document.removeEventListener("touchmove", onTouchMove);
      moveAttached = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      // iOS back-gesture reserve: Safari owns the first 18px.
      if (!openRef.current && touch.clientX < EDGE_IGNORE_PX) return;
      // Opt-out escape hatch for horizontally-scrollable children.
      const target = e.target as Element | null;
      if (target?.closest("[data-no-drawer-swipe]")) return;

      const g = gestureRef.current;
      g.startX = touch.clientX;
      g.startY = touch.clientY;
      g.startedOpen = openRef.current;
      g.lock = null;
      g.dragging = false;
      g.samples = [{ x: touch.clientX, t: performance.now() }];
      attachMove();
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const g = gestureRef.current;
      if (g.samples.length === 0) return;

      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;
      const now = performance.now();

      if (g.lock === null) {
        const direction = classifyDirection(dx, dy);
        if (direction === null) return;
        if (direction === "vertical") {
          g.lock = "scroll";
          return;
        }
        // When closed, leftward pans don't open anything — yield to scroll.
        if (!g.startedOpen && dx < 0) {
          g.lock = "scroll";
          return;
        }
        g.lock = "drawer";
        g.dragging = true;
      }

      if (g.lock === "drawer") {
        if (e.cancelable) e.preventDefault();
        const base = g.startedOpen ? 0 : -DRAWER_WIDTH_PX;
        const next = Math.min(0, Math.max(-DRAWER_WIDTH_PX, base + dx));
        x.set(next);
        pushSample(g.samples, touch.clientX, now);
      }
    };

    const onTouchEnd = () => {
      const g = gestureRef.current;
      detachMove();
      if (!g.dragging) {
        gestureRef.current = freshGesture();
        return;
      }
      const velocity = estimateVelocity(g.samples);
      const current = x.get();
      const displacement = (current + DRAWER_WIDTH_PX) / DRAWER_WIDTH_PX;

      let shouldOpen: boolean;
      if (velocity > OPEN_VELOCITY_THRESHOLD) shouldOpen = true;
      else if (velocity < -OPEN_VELOCITY_THRESHOLD) shouldOpen = false;
      else shouldOpen = displacement > OPEN_DISPLACEMENT_RATIO;

      gestureRef.current = freshGesture();

      animate(x, shouldOpen ? 0 : -DRAWER_WIDTH_PX, { ...SPRING_CONFIG, velocity });
      if (shouldOpen !== openRef.current) notifyOpenChange(shouldOpen);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      detachMove();
    };
  }, [x]);

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        aria-hidden
        style={{
          opacity: overlayOpacity,
          pointerEvents: open ? "auto" : "none",
        }}
        className="fixed inset-0 z-40 bg-neutral-950"
        onClick={() => onOpenChange(false)}
      />
      <m.aside
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar"
        style={{ x, width: `${DRAWER_WIDTH_REM}rem` }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground shadow-xl",
          "flex h-full flex-col",
          className,
        )}
        data-no-drawer-swipe
      >
        {children}
      </m.aside>
    </LazyMotion>
  );
};
