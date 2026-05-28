import type { ComponentType, ReactNode } from "react";

import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import {
  AtSignIcon,
  CalendarIcon,
  ClockIcon,
  HashIcon,
  LinkIcon,
  PhoneIcon,
  TextIcon,
} from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormInputNode } from "@/hooks/use-form-input-node";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<{ className?: string }>;

type FormFieldVariant = {
  /** Tooltip label shown to the editor on the trailing icon. */
  label: string;
  /** Trailing icon component. */
  icon: IconComponent;
  /** Default placeholder when the node doesn't carry one explicitly. */
  defaultPlaceholder?: string;
  /**
   * Escape hatch for variants that need a non-trivial editor preview later
   * (e.g. an inline date-picker stub). Returning a ReactNode replaces the
   * default shell entirely. None of the current variants use it — kept here
   * so adding one in the future doesn't require splitting the file back up.
   */
  customRender?: (props: PlateElementProps) => ReactNode;
};

const VARIANTS: Record<string, FormFieldVariant> = {
  formInput: { label: "Short answer", icon: TextIcon },
  formEmail: { label: "Email", icon: AtSignIcon },
  formPhone: { label: "Phone", icon: PhoneIcon },
  formNumber: { label: "Number", icon: HashIcon },
  formLink: { label: "Link", icon: LinkIcon },
  formDate: { label: "Date", icon: CalendarIcon, defaultPlaceholder: "Select a date" },
  formTime: { label: "Time", icon: ClockIcon, defaultPlaceholder: "Select a time" },
};

export const FormFieldElement = (allProps: PlateElementProps) => {
  const { children, ...props } = allProps;
  const { attributes, element, ...rest } = props;
  // Hook is unconditional (rules-of-hooks); variant gating happens after.
  const { focused, isSelected } = useFormInputNode(element);
  const variant = VARIANTS[element.type];
  if (!variant) return null;
  if (variant.customRender) return variant.customRender(allProps);

  const placeholder = (element.placeholder as string | undefined) ?? variant.defaultPlaceholder;
  const Icon = variant.icon;
  const isFieldArray = (element as { isFieldArray?: boolean }).isFieldArray === true;
  // Match the live preview's RepeatableField add button (variant=secondary,
  // size=sm) but keep it non-interactive — Plate's editable surface owns the
  // click. `aria-hidden` so AT skips the duplicate.
  const addLabelText = (() => {
    const label = (element as { label?: string }).label;
    return `Add${label ? ` ${label.toLowerCase()}` : " item"}`;
  })();

  return (
    <div className="w-full max-w-[464px]">
      <PlateElement
        attributes={{ ...attributes, placeholder, "data-bf-input": "true" }}
        className={cn(
          "relative flex h-7 w-full cursor-text items-center gap-[4px] rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] pr-[8px] pl-[10px] text-sm caret-current elevation-sm",
          isSelected && focused && "ring-[3px] ring-ring/50",
        )}
        element={element}
        {...rest}
      >
        <span className="line-clamp-1 min-w-0 flex-1 break-all text-muted-foreground/50 outline-none">
          {children}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className="ml-1 flex shrink-0 items-center justify-center text-muted-foreground select-none"
                contentEditable={false}
              />
            }
          >
            <Icon className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="left">{variant.label}</TooltipContent>
        </Tooltip>
      </PlateElement>
      {isFieldArray && (
        <span
          contentEditable={false}
          aria-hidden="true"
          className="mt-2 inline-flex h-7 w-fit cursor-default items-center gap-1.5 rounded-lg border-none bg-secondary px-2.5 text-[0.8rem] font-normal text-secondary-foreground shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] select-none"
        >
          <span aria-hidden="true">+</span>
          {addLabelText}
        </span>
      )}
    </div>
  );
};
