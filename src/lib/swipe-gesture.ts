/**
 * Shared primitives for the mobile drawer gestures. Both drawers (left
 * sidebar, right editor panel) do the same direction-lock + velocity-sampling
 * + spring-release dance; keeping the knobs in one place prevents drift.
 */

export const DIRECTION_LOCK_THRESHOLD_PX = 8;
export const VERTICAL_DOMINANCE_RATIO = 1.2;
export const SPRING_CONFIG = { type: "spring" as const, stiffness: 400, damping: 40 };
export const VELOCITY_SAMPLE_MS = 80;

export type GestureLock = "drawer" | "scroll" | null;

export interface VelocitySample {
  x: number;
  t: number;
}

/** Append a (x, t) sample and drop any older than `VELOCITY_SAMPLE_MS`. */
export const pushSample = (samples: VelocitySample[], x: number, now: number): void => {
  samples.push({ x, t: now });
  const cutoff = now - VELOCITY_SAMPLE_MS;
  while (samples.length > 2 && samples[0].t < cutoff) samples.shift();
};

/** px/sec from the oldest kept sample to the most recent. */
export const estimateVelocity = (samples: VelocitySample[]): number => {
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = Math.max(1, last.t - first.t);
  return ((last.x - first.x) / dt) * 1000;
};

/**
 * Decide whether a touchmove delta is a drawer gesture or a native scroll.
 * Returns `null` while movement is still below the noise threshold — caller
 * should keep waiting for more movement.
 */
export const classifyDirection = (dx: number, dy: number): "horizontal" | "vertical" | null => {
  if (Math.abs(dx) < DIRECTION_LOCK_THRESHOLD_PX && Math.abs(dy) < DIRECTION_LOCK_THRESHOLD_PX) {
    return null;
  }
  if (Math.abs(dy) > Math.abs(dx) * VERTICAL_DOMINANCE_RATIO) return "vertical";
  return "horizontal";
};
