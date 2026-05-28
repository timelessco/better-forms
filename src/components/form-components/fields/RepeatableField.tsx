import { Suspense } from "react";

import type { AppForm } from "@/hooks/use-form-builder";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { cn } from "@/lib/utils";
import { FieldSkeleton } from "../field-skeleton";
import type { FieldType } from "./shared";

// The local AppForm.AppField type only declares the scalar `{ name, children }`
// signature; the underlying TanStack createFormHook field exposes
// `mode="array"` + `pushValue`/`removeValue`. Narrow-cast here rather than
// widening the global AppForm type and breaking every scalar call site.
type ArrayFieldApi = {
  state: { value: unknown };
  pushValue: (value: unknown) => void;
  removeValue: (index: number) => void;
};
type ArrayAppField = React.ComponentType<{
  name: string;
  mode: "array";
  children: (field: ArrayFieldApi) => React.ReactElement;
}>;

type ItemComponent = React.ComponentType<{ element: never; form: AppForm; name?: string }>;

/**
 * Renders a repeatable scalar field as a TanStack `mode="array"` field: one
 * `ItemComponent` per array entry (bound to the indexed name), a per-item
 * remove control (hidden when at the 1-item minimum), and an "Add" button.
 */
export const RepeatableField = ({
  element,
  form,
  ItemComponent,
}: {
  element: PlateFormField;
  form: AppForm;
  ItemComponent: ItemComponent;
}) => {
  const AppField = form.AppField as unknown as ArrayAppField;
  return (
    <AppField name={element.name} mode="array">
      {(arrayField) => {
        const items = (arrayField.state.value as unknown[]) ?? [];
        const itemCount = items.length;
        return (
          <div className="flex flex-col gap-2">
            {items.map((_, i) => (
              // Array index is the stable identity here — items are primitive
              // strings with no id, and TanStack's array docs key by index.
              // eslint-disable-next-line @eslint-react/no-array-index-key
              <div key={i} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Suspense fallback={<FieldSkeleton fieldType={element.fieldType as FieldType} />}>
                    <ItemComponent
                      element={element as never}
                      form={form}
                      name={`${element.name}[${i}]`}
                    />
                  </Suspense>
                </div>
                {itemCount > 1 && (
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => arrayField.removeValue(i)}
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[8px]",
                      "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <title>Remove</title>
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => arrayField.pushValue("")}
              className="flex w-fit items-center gap-1 text-sm text-primary hover:underline"
            >
              <span aria-hidden="true">+</span>
              {(() => {
                const label = "label" in element ? element.label : undefined;
                return `Add${label ? ` ${label.toLowerCase()}` : " item"}`;
              })()}
            </button>
          </div>
        );
      }}
    </AppField>
  );
};
