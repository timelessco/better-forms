import { useEffect, useRef, useState } from "react";
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";

/**
 * Smoothly animates width/height changes of its content (ResizeObserver + spring), so a popup
 * can morph between views of different sizes. Provides its own LazyMotion, so `m.*` children
 * (e.g. AnimatePresence fades) work without another provider. Respects prefers-reduced-motion.
 */
export const AnimatedSize = ({ children }: { children: React.ReactNode }) => {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ height: number; width: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { height, width } = entry.contentRect;
      // Skip zero sizes (popup closing) — let the parent's exit animation handle it.
      if (height > 0 && width > 0) setSize({ height, width });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        animate={size ?? undefined}
        style={{ overflow: "clip" }}
        // bounce 0: a bouncy spring's settle tail reads as lag on a popup this small.
        transition={
          shouldReduceMotion ? { duration: 0 } : { bounce: 0, duration: 0.2, type: "spring" }
        }
      >
        <div className="w-fit" ref={ref}>
          {children}
        </div>
      </m.div>
    </LazyMotion>
  );
};
