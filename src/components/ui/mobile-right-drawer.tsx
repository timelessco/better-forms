import { animate, domAnimation, LazyMotion, m, useMotionValue } from "motion/react";
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  classifyDirection,
  estimateVelocity,
  pushSample,
  SPRING_CONFIG,
} from "@/lib/swipe-gesture";
import type { GestureLock, VelocitySample } from "@/lib/swipe-gesture";

/**
 * Right-anchored mobile drawer for editor sidebars (Share, Settings, Customize, Version History).
 * Differs from the left drawer:
 *   - No open-from-anywhere — opened via buttons; edge swipe would collide with iOS forward-nav
 *     and editor horizontal scrollers (tables).
 *   - Drag-to-close scoped to the drawer element, not document.
 */

const CLOSE_VELOCITY_THRESHOLD = 500;
const CLOSE_DISPLACEMENT_RATIO = 0.35;

interface MobileRightDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

interface GestureState {
  startX: number;
  startY: number;
  lock: GestureLock;
  dragging: boolean;
  samples: VelocitySample[];
}

const freshGesture = (): GestureState => ({
  startX: 0,
  startY: 0,
  lock: null,
  dragging: false,
  samples: [],
});

export const MobileRightDrawer = ({
  open,
  onClose,
  children,
  className,
}: MobileRightDrawerProps) => {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef<number>(0);
  // Start off-screen when closed so first paint doesn't flash open before width is measured.
  const x = useMotionValue(open ? 0 : 9999);
  const gestureRef = useRef<GestureState>(freshGesture());

  // Sync widthRef/x with rendered size — initial measure plus later viewport changes (rotation, resize).
  useLayoutEffect(() => {
    const el = drawerRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.getBoundingClientRect().width;
      if (w === 0) return;
      widthRef.current = w;
      if (!open && !gestureRef.current.dragging) x.set(w);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, x]);

  useEffect(() => {
    const w = widthRef.current;
    if (w === 0) return;
    animate(x, open ? 0 : w, SPRING_CONFIG);
  }, [open, x]);

  const notifyClose = useEffectEvent(() => onClose());

  useEffect(() => {
    const el = drawerRef.current;
    if (!el || !open) return;

    let moveAttached = false;
    const attachMove = () => {
      if (moveAttached) return;
      // eslint-disable-next-line react-doctor/client-passive-event-listeners -- handler intentionally calls preventDefault to suppress page scroll during drawer drag; passive listeners would silently ignore preventDefault
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      moveAttached = true;
    };
    const detachMove = () => {
      if (!moveAttached) return;
      el.removeEventListener("touchmove", onTouchMove);
      moveAttached = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if ((e.target as Element | null)?.closest("[data-no-drawer-swipe]")) return;
      const g = gestureRef.current;
      g.startX = touch.clientX;
      g.startY = touch.clientY;
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

      if (g.lock === null) {
        const direction = classifyDirection(dx, dy);
        if (direction === null) return;
        if (direction === "vertical") {
          g.lock = "scroll";
          return;
        }
        // Only rightward pans (closing) count; leftward does nothing.
        if (dx < 0) {
          g.lock = "scroll";
          return;
        }
        g.lock = "drawer";
        g.dragging = true;
      }

      if (g.lock === "drawer") {
        if (e.cancelable) e.preventDefault();
        const w = widthRef.current || 0;
        x.set(Math.min(w, Math.max(0, dx)));
        pushSample(g.samples, touch.clientX, performance.now());
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
      const w = widthRef.current || 1;
      const displacement = x.get() / w;

      let shouldClose: boolean;
      if (velocity > CLOSE_VELOCITY_THRESHOLD) shouldClose = true;
      else if (velocity < -CLOSE_VELOCITY_THRESHOLD) shouldClose = false;
      else shouldClose = displacement > CLOSE_DISPLACEMENT_RATIO;

      gestureRef.current = freshGesture();

      if (shouldClose) {
        animate(x, w, { ...SPRING_CONFIG, velocity });
        notifyClose();
      } else {
        animate(x, 0, { ...SPRING_CONFIG, velocity });
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      detachMove();
    };
  }, [open, x]);

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        aria-hidden
        initial={false}
        animate={{ opacity: open ? 0.5 : 0 }}
        transition={{ duration: 0.2 }}
        style={{ pointerEvents: open ? "auto" : "none" }}
        className="fixed inset-0 z-40 bg-neutral-950"
        onClick={onClose}
      />
      <m.aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        style={{ x }}
        className={cn(
          "fixed inset-y-0 right-0 z-50 bg-background shadow-xl",
          "flex h-full flex-col",
          "w-[min(85vw,22rem)]",
          !open && "pointer-events-none",
          className,
        )}
      >
        {children}
      </m.aside>
    </LazyMotion>
  );
};
