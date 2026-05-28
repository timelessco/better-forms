import { Suspense, useEffect } from "react";

import { Button } from "@/components/ui/button";
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
  state: {
    value: unknown;
    meta: { errors: unknown[]; isTouched: boolean };
  };
  pushValue: (value: unknown) => void;
  removeValue: (index: number) => void;
};
type ArrayAppField = React.ComponentType<{
  name: string;
  mode: "array";
  children: (field: ArrayFieldApi) => React.ReactElement;
}>;

type ItemComponent = React.ComponentType<{ element: never; form: AppForm; name?: string }>;

const extractErrorMessage = (err: unknown): string | null => {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === "string" ? msg : null;
  }
  return null;
};

const getSeedValue = (element: PlateFormField): string => {
  if ("defaultValue" in element && typeof element.defaultValue === "string") {
    return element.defaultValue;
  }
  return "";
};

const RepeatableFieldBody = ({
  arrayField,
  element,
  form,
  ItemComponent,
}: {
  arrayField: ArrayFieldApi;
  element: PlateFormField;
  form: AppForm;
  ItemComponent: ItemComponent;
}) => {
  // Stored value is `unknown` because the field can land here as either:
  // (a) the intended `string[]`, (b) the scalar string left over from before
  // the field was flipped to repeatable, or (c) undefined (no draft yet).
  // Only (a) renders; (b) and (c) trigger the seed effect below.
  const rawValue = arrayField.state.value;
  const items = Array.isArray(rawValue) ? rawValue : [];
  const itemCount = items.length;

  // Required UX: a repeatable field always shows at least one input. When the
  // stored value isn't a usable array (legacy scalar / undefined / empty), seed
  // one item so the respondent has somewhere to type. Effect runs once per
  // empty observation; pushing flips the dependency and the effect bails next
  // render.
  const seed = getSeedValue(element);
  useEffect(() => {
    if (itemCount === 0) {
      arrayField.pushValue(seed);
    }
  }, [itemCount, arrayField, seed]);

  const label = "label" in element ? element.label : undefined;
  const addLabel = `Add${label ? ` ${label.toLowerCase()}` : " item"}`;

  // Errors raised at the *array* root (e.g. `min(1)` when the array is somehow
  // empty) shouldn't normally happen now that auto-seed guarantees ≥1 item and
  // per-item rules cover required/format. Keep the fallback for safety.
  const arrayErrors = arrayField.state.meta.errors;
  const arrayErrorMessage =
    arrayField.state.meta.isTouched && arrayErrors.length > 0
      ? extractErrorMessage(arrayErrors[0])
      : null;

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
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => arrayField.pushValue(seed)}
        className="mt-1 w-fit"
        prefix={<span aria-hidden="true">+</span>}
      >
        {addLabel}
      </Button>
      {arrayErrorMessage && (
        <p className="mt-1.5 text-sm text-destructive" role="alert">
          {arrayErrorMessage}
        </p>
      )}
    </div>
  );
};

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
      {(arrayField) => (
        <RepeatableFieldBody
          arrayField={arrayField}
          element={element}
          form={form}
          ItemComponent={ItemComponent}
        />
      )}
    </AppField>
  );
};
