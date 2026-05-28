import { createContext, lazy, Suspense } from "react";

import type { AppForm } from "@/hooks/use-form-builder";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { FieldSkeleton } from "./field-skeleton";
import { RepeatableField } from "./fields/RepeatableField";
import {
  FieldLabelText,
  GROUP_FIELD_TYPES,
  fieldLabelId,
  getFieldLabelProps,
} from "./fields/shared";
import type { FieldType } from "./fields/shared";

const isFieldArrayElement = (element: PlateFormField): boolean =>
  "isFieldArray" in element && (element as { isFieldArray?: boolean }).isFieldArray === true;

// Editor preview supplies an eager (static-import) renderer here to avoid the
// lazy-chunk flash when stepping between pages. Live form leaves it null and
// keeps code-splitting.
export const PreviewRendererContext = createContext<React.ComponentType<{
  element: PlateFormField;
  form: AppForm;
}> | null>(null);

// One chunk per field type. A form that only uses Input + Textarea pulls only
// those two chunks — PhoneInput, DatePicker, MultiSelect, useFileUpload, etc.
// stay out of the critical path.
const FIELD_RENDERERS: Record<
  FieldType,
  React.LazyExoticComponent<React.ComponentType<{ element: never; form: AppForm }>>
> = {
  Input: lazy(() => import("./fields/InputField")),
  Textarea: lazy(() => import("./fields/TextareaField")),
  Email: lazy(() => import("./fields/EmailField")),
  Phone: lazy(() => import("./fields/PhoneField")),
  Number: lazy(() => import("./fields/NumberField")),
  Link: lazy(() => import("./fields/LinkField")),
  Date: lazy(() => import("./fields/DateField")),
  Time: lazy(() => import("./fields/TimeField")),
  FileUpload: lazy(() => import("./fields/FileUploadField")),
  Checkbox: lazy(() => import("./fields/CheckboxField")),
  MultiChoice: lazy(() => import("./fields/MultiChoiceField")),
  MultiSelect: lazy(() => import("./fields/MultiSelectField")),
  Ranking: lazy(() => import("./fields/RankingField")),
} as const;

interface RenderStepPreviewInputProps {
  element: PlateFormField;
  form: AppForm;
}

export const PreviewInputShell = ({
  element,
  children,
}: {
  element: PlateFormField;
  children: React.ReactNode;
}) => {
  const { label, required, labelType } = getFieldLabelProps(element);
  // Group fields (Checkbox/MultiChoice/Ranking) render N controls and have no
  // single labelable input — wrap them in role=group with aria-labelledby
  // pointing at the visible label/heading id. For all other field types the
  // standard `<label htmlFor>` / heading + `aria-labelledby` wiring handles
  // accessibility (the field component itself reads it via element.name).
  const isGroup =
    ("fieldType" in element && GROUP_FIELD_TYPES.has(element.fieldType)) ||
    isFieldArrayElement(element);
  const groupAriaProps =
    isGroup && label
      ? { role: "group" as const, "aria-labelledby": fieldLabelId(element.name) }
      : {};
  return (
    <div data-bf-input="true" data-bf-standalone={label ? undefined : "true"} {...groupAriaProps}>
      <FieldLabelText
        text={label}
        labelType={labelType}
        htmlFor={element.name}
        required={required}
        asGroupLabel={isGroup}
      />
      {children}
    </div>
  );
};

// Just the field input (lazy-loaded) with no label/wrapper. Used by the RSC
// flow where the server-rendered composite already provides the surrounding
// `<div data-bf-input>` + label.
export const RenderFieldComponent = ({ element, form }: RenderStepPreviewInputProps) => {
  if (element.fieldType === "Button") return null;
  const Component = FIELD_RENDERERS[element.fieldType as FieldType];
  if (!Component) return null;
  if (isFieldArrayElement(element)) {
    return <RepeatableField element={element} form={form} ItemComponent={Component as never} />;
  }
  return (
    <Suspense fallback={<FieldSkeleton fieldType={element.fieldType as FieldType} />}>
      <Component element={element as never} form={form} />
    </Suspense>
  );
};

export const RenderStepPreviewInput = ({ element, form }: RenderStepPreviewInputProps) => {
  if (element.fieldType === "Button") return null;
  const Component = FIELD_RENDERERS[element.fieldType as FieldType];
  if (!Component) return null;
  const isFieldArray = isFieldArrayElement(element);
  return (
    <PreviewInputShell element={element}>
      {isFieldArray ? (
        <RepeatableField element={element} form={form} ItemComponent={Component as never} />
      ) : (
        <Suspense fallback={<FieldSkeleton fieldType={element.fieldType as FieldType} />}>
          <Component element={element as never} form={form} />
        </Suspense>
      )}
    </PreviewInputShell>
  );
};
