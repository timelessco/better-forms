import { cn } from "@/lib/utils";

interface SuccessCheckProps {
  className?: string;
  /** Pixel size of the rendered SVG. */
  size?: number;
}

/**
 * Checkmark: fades in, rotates upright, Y-bobs, draws stroke. Mount on success so appear anim runs once.
 * Stroke-draw length is calibrated statically in `.t-success-check svg path` (transitions.css) to match the fixed `d` below.
 */
export const SuccessCheck = ({ className, size = 48 }: SuccessCheckProps) => (
  <span className={cn("t-success-check", className)} data-state="in" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none" width={size} height={size}>
      <path
        d="M13 24l8 8 14-16"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);
