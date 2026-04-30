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

export const extractErrorMessage = (error: unknown): string => {
  if (!error) return "Invalid value";
  if (Array.isArray(error)) return extractErrorMessage(error[0]);
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof (error as { message: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
  }
  if (typeof error === "string") return error;
  return "Invalid value";
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
              d="M12.3892 5.68944L12.793 6.92754L9.02484 8.21946L11.4741 11.53L10.4244 12.3375L7.94824 8.91925L5.57971 12.3106L4.53002 11.5031L6.89855 8.21946L3.15735 6.95445L3.58799 5.68944L7.27536 7.00828V3.02484H8.64803V6.98137L12.3892 5.68944Z"
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
        <h1 className="font-heading flex-1 text-4xl font-bold">{text}</h1>
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
    <Label htmlFor={htmlFor} className="w-full py-2.5">
      <span className="flex-1">{text}</span>
      {badge}
    </Label>
  );
};
