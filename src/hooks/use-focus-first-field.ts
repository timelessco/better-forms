import type { RefObject } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

// Scope to [data-bf-input] (each question's wrapper) so the form-level
// Next/Submit button — which lives outside that wrapper — is never picked.
// Widget triggers (DatePicker <button>, MultiSelect role="button" div) need
// explicit matches; native inputs/textarea/select cover the rest. Base UI
// <Checkbox> renders role="checkbox", so checkbox/multichoice groups focus
// their first option.
const FOCUSABLE_FIELD_SELECTOR =
  '[data-bf-input] :is(input:not([type="hidden"]), textarea, select, button, [role="checkbox"], [role="button"], [role="combobox"])';

// Two rAFs: mount commits, then paint, then we focus. Beats a hardcoded
// timeout that races transitions of unknown duration.
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
