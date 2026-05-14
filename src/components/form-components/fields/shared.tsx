import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AppForm } from "@/hooks/use-form-builder";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { cn } from "@/lib/utils";

export type FieldType = Exclude<PlateFormField["fieldType"], "Button">;

export type FieldRendererProps<
  T extends PlateFormField["fieldType"] = PlateFormField["fieldType"],
> = {
  element: Extract<PlateFormField, { fieldType: T }>;
  form: AppForm;
};

export const getFieldLabelProps = (element: PlateFormField) => ({
  label: "label" in element ? (element.label ?? "") : "",
  required: "required" in element ? !!element.required : false,
  labelType: "labelType" in element ? element.labelType : undefined,
});

export const getAriaLabelFallback = (element: PlateFormField): string | undefined => {
  const label = "label" in element ? element.label : undefined;
  if (label) return undefined;
  const placeholder = "placeholder" in element ? element.placeholder : undefined;
  return placeholder ?? "Field";
};

const RequiredBadge = () => (
  <Tooltip>
    <TooltipTrigger
      render={
        <span
          aria-label="Required field"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[8px] bg-destructive/15 text-destructive",
            "mr-1 ml-auto",
          )}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Required</title>
            <path
              d="M12.39 5.69L12.79 6.93L9.02 8.22L11.47 11.53L10.42 12.34L7.95 8.92L5.58 12.31L4.53 11.5L6.9 8.22L3.16 6.95L3.59 5.69L7.28 7.01V3.02H8.65V6.98L12.39 5.69Z"
              fill="currentColor"
            />
          </svg>
        </span>
      }
    />
    <TooltipContent side="right">Required</TooltipContent>
  </Tooltip>
);

export const FieldLabelText = ({
  text,
  labelType,
  htmlFor,
  required,
}: {
  text: string;
  labelType?: string;
  htmlFor: string;
  required?: boolean;
}) => {
  if (!text) return null;
  const badge = required ? <RequiredBadge /> : null;

  if (labelType === "h1") {
    return (
      <div className="flex w-full items-center py-2.5">
        <h1 className="font-heading flex-1 text-4xl font-semibold">{text}</h1>
        {badge}
      </div>
    );
  }
  if (labelType === "h2") {
    return (
      <div className="flex w-full items-center py-2.5">
        <h2 className="font-heading flex-1 text-2xl font-semibold">{text}</h2>
        {badge}
      </div>
    );
  }
  if (labelType === "h3") {
    return (
      <div className="flex w-full items-center py-2.5">
        <h3 className="font-heading flex-1 text-xl font-semibold">{text}</h3>
        {badge}
      </div>
    );
  }
  if (labelType === "blockquote") {
    return (
      <div className="flex w-full items-center py-2.5">
        <blockquote className="flex-1 border-l-2 pl-6 italic">{text}</blockquote>
        {badge}
      </div>
    );
  }

  return (
    <Label htmlFor={htmlFor} className="w-full" data-bf-field-label>
      <span className="flex-1">{text}</span>
      {badge}
    </Label>
  );
};
