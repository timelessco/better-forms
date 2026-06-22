import type { ComponentType, ReactNode } from "react";

import type { PlateElementProps } from "platejs/react";

import { PlateElement, useEditorRef } from "platejs/react";

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
import { useFieldLabelText } from "@/hooks/use-form-input-node";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<{ className?: string }>;

type FormFieldVariant = {
  /** Tooltip label shown to the editor on the trailing icon. */
  label: string;
  /** Trailing icon component. */
  icon: IconComponent;
  /** Default placeholder when the node doesn't carry one explicitly. */
  defaultPlaceholder?: string;
  /** Escape hatch: return a ReactNode to fully replace the default shell. Unused today, kept for future variants. */
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
  // Pulled from the preceding label block so the editor's add-item indicator
  // reads e.g. "Add full name" (matching the live preview) instead of the
  // generic "Add item". Hook subscribes to label edits and updates live.
  const fieldLabel = useFieldLabelText(element);
  const editor = useEditorRef();
  const variant = VARIANTS[element.type];
  if (!variant) return null;
  if (variant.customRender) return variant.customRender(allProps);

  const placeholder = (element.placeholder as string | undefined) ?? variant.defaultPlaceholder;
  const Icon = variant.icon;
  const isFieldArray = (element as { isFieldArray?: boolean }).isFieldArray === true;
  const rawInitialRows = (element as { initialRows?: number }).initialRows;
  const initialRows =
    isFieldArray && typeof rawInitialRows === "number" && rawInitialRows > 0
      ? Math.floor(rawInitialRows)
      : 1;
  const addLabelText = `Add${fieldLabel ? ` ${fieldLabel.toLowerCase()}` : " item"}`;

  const setInitialRows = (next: number) => {
    const path = editor.api.findPath(element);
    if (!path) return;
    const clamped = Math.max(1, next);
    if (clamped === 1) {
      editor.tf.unsetNodes(["initialRows"], { at: path });
    } else {
      editor.tf.setNodes({ initialRows: clamped }, { at: path });
    }
  };

  return (
    <div className="w-full">
      <PlateElement
        attributes={{
          ...attributes,
          placeholder,
          "data-bf-input": "true",
          "data-bf-input-fill": "true",
        }}
        className={cn(
          "relative flex h-[30px] w-full cursor-text items-center gap-[4px] rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] px-[10px] text-sm caret-current elevation-sm",
        )}
        element={element}
        {...rest}
      >
        <span
          className="line-clamp-1 min-w-0 flex-1 break-all text-muted-foreground/50 outline-none"
          data-bf-placeholder
        >
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
        <>
          {Array.from({ length: initialRows - 1 }, (_, i) => (
            // Decorative mirror rows: each click of the "+ Add" pill below bumps
            // `initialRows` on the node, and the published form opens with that
            // many rows. Mirrors are non-editable — only the real PlateElement
            // above carries the (shared) placeholder + validation config.
            <div
              key={`mirror-${i.toString()}`}
              contentEditable={false}
              className="mt-2 flex items-center gap-2 select-none"
            >
              <div
                className="relative flex h-[30px] flex-1 items-center gap-[4px] rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] px-[10px] text-sm elevation-sm"
                aria-hidden="true"
              >
                <span
                  className="line-clamp-1 min-w-0 flex-1 break-all text-muted-foreground/50"
                  data-bf-placeholder
                >
                  {placeholder}
                </span>
                <Icon className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
              </div>
              <button
                type="button"
                aria-label="Remove row"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setInitialRows(initialRows - 1)}
                className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-secondary hover:text-foreground"
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
            </div>
          ))}
          <button
            type="button"
            contentEditable={false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setInitialRows(initialRows + 1)}
            className="mt-2 inline-flex h-7 w-fit cursor-pointer items-center gap-1.5 rounded-lg border-none bg-secondary px-2.5 text-[0.8rem] font-normal text-secondary-foreground shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] select-none hover:bg-secondary/80"
          >
            <span aria-hidden="true">+</span>
            {addLabelText}
          </button>
        </>
      )}
    </div>
  );
};
