import { useEffect } from "react";

/**
 * Runs an effect exactly once on mount. Wraps useEffect with an empty
 * dependency array to make the "mount-only" intent explicit.
 */
export const useMountEffect = (effect: () => void | (() => void)) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
};
