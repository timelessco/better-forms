import { useEffect } from "react";

/** Runs an effect once on mount — useEffect with empty deps, intent explicit. */
export const useMountEffect = (effect: () => void | (() => void)) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
};
