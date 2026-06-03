import { useMemo } from "react";

import { DropdownSelect } from "@/components/ui/dropdown-select";
import { cn } from "@/lib/utils";
import { getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

/** Fisher-Yates copy — stable per render (memoized), avoids mutating element.options. */
const shuffleOptions = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const DropdownField = ({ element, form }: FieldRendererProps<"Dropdown">) => {
  // Shuffle once per mount when enabled, so option order stays stable while answering.
  const options = useMemo(
    () => (element.shuffle ? shuffleOptions(element.options) : element.options),
    [element.options, element.shuffle],
  );

  return (
    <form.AppField name={element.name}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        const selectedValue = (f.state.value as string | undefined) ?? "";

        return (
          <>
            <DropdownSelect
              id={element.name}
              options={options}
              value={selectedValue}
              onChange={(val) => f.handleChange(val)}
              aria-invalid={hasErrors}
              aria-labelledby={getAriaLabelledBy(element)}
              className={cn(hasErrors && "ring-1 ring-destructive")}
            />
            <f.FieldError />
          </>
        );
      }}
    </form.AppField>
  );
};

export default DropdownField;
