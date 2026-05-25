import type { AppForm } from "@/hooks/use-form-builder";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";

import CheckboxField from "./fields/CheckboxField";
import DateField from "./fields/DateField";
import EmailField from "./fields/EmailField";
import FileUploadField from "./fields/FileUploadField";
import InputField from "./fields/InputField";
import LinkField from "./fields/LinkField";
import MultiChoiceField from "./fields/MultiChoiceField";
import MultiSelectField from "./fields/MultiSelectField";
import NumberField from "./fields/NumberField";
import PhoneField from "./fields/PhoneField";
import RankingField from "./fields/RankingField";
import type { FieldType } from "./fields/shared";
import TextareaField from "./fields/TextareaField";
import TimeField from "./fields/TimeField";
import { PreviewInputShell } from "./render-step-preview-input";

// Static-import twin of `RenderStepPreviewInput` for the form-builder preview.
// The lazy/Suspense variant flashes empty when stepping into a chunk that
// hasn't loaded yet; in the editor preview the auth bundle already contains
// every field, so chunk-splitting buys us nothing and costs perceived speed.
const FIELD_RENDERERS: Record<FieldType, React.ComponentType<{ element: never; form: AppForm }>> = {
  Input: InputField,
  Textarea: TextareaField,
  Email: EmailField,
  Phone: PhoneField,
  Number: NumberField,
  Link: LinkField,
  Date: DateField,
  Time: TimeField,
  FileUpload: FileUploadField,
  Checkbox: CheckboxField,
  MultiChoice: MultiChoiceField,
  MultiSelect: MultiSelectField,
  Ranking: RankingField,
} as const;

export const RenderStepPreviewInputEager = ({
  element,
  form,
}: {
  element: PlateFormField;
  form: AppForm;
}) => {
  if (element.fieldType === "Button") return null;
  const Component = FIELD_RENDERERS[element.fieldType as FieldType];
  if (!Component) return null;
  return (
    <PreviewInputShell element={element}>
      <Component element={element as never} form={form} />
    </PreviewInputShell>
  );
};
