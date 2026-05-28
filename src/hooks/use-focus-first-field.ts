import type { RefObject } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

// Scoped to [data-bf-input] so the outside Next/Submit button is never picked. role=button/checkbox/combobox match widget triggers; native inputs cover the rest.
const FOCUSABLE_FIELD_SELECTOR =
  '[data-bf-input] :is(input:not([type="hidden"]), textarea, select, button, [role="checkbox"], [role="button"], [role="combobox"])';

// Two rAFs: commit, paint, then focus. Beats a timeout racing transitions of unknown duration.
export const useFocusFirstField = (formRef: RefObject<HTMLFormElement | null>) => {
  useMountEffect(() => {
    let cancelled = false;
    let innerHandle: number | null = null;
    const outerHandle = requestAnimationFrame(() => {
      innerHandle = requestAnimationFrame(() => {
        if (cancelled || !formRef.current) return;
        const focusable = formRef.current.querySelector(
          FOCUSABLE_FIELD_SELECTOR,
        ) as HTMLElement | null;
        focusable?.focus();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outerHandle);
      if (innerHandle !== null) cancelAnimationFrame(innerHandle);
    };
  });
};
