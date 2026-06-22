import type { PlateElementProps } from "platejs/react";

import { PlateElement, useEditorRef } from "platejs/react";

import { AlignLeftIcon } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFieldLabelText } from "@/hooks/use-form-input-node";
import { cn } from "@/lib/utils";

export const FormTextareaElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const placeholder = element.placeholder as string | undefined;
  // Pulled from the preceding label block so the editor's add-item indicator
  // reads e.g. "Add full name" (matching the live preview) instead of the
  // generic "Add item". Hook subscribes to label edits and updates live.
  const fieldLabel = useFieldLabelText(element);
  const editor = useEditorRef();
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
        attributes={{ ...attributes, placeholder, "data-bf-input": "true" }}
        className={cn(
          "relative flex min-h-24 w-full cursor-text items-start gap-[4px] rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] pr-[8px] pl-[10px] text-sm caret-current elevation-sm before:top-2.5",
        )}
        element={element}
        {...rest}
      >
        <span
          className="block min-w-px flex-1 pt-2.5 pb-2 text-[14px] leading-[22px] text-muted-foreground/50 outline-none"
          data-bf-placeholder
        >
          {children}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                contentEditable={false}
                className="mt-3 ml-1 flex shrink-0 items-center justify-center self-start text-muted-foreground select-none"
              />
            }
          >
            <AlignLeftIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="left">Long answer</TooltipContent>
        </Tooltip>
      </PlateElement>
      {isFieldArray && (
        <>
          {Array.from({ length: initialRows - 1 }, (_, i) => (
            <div
              key={`mirror-${i.toString()}`}
              contentEditable={false}
              className="mt-2 flex items-start gap-2 select-none"
            >
              <div
                className="relative flex min-h-24 flex-1 items-start gap-[4px] rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] pr-[8px] pl-[10px] text-sm elevation-sm"
                aria-hidden="true"
              >
                <span
                  className="block min-w-px flex-1 pt-2.5 pb-2 text-[14px] leading-[22px] text-muted-foreground/50"
                  data-bf-placeholder
                >
                  {placeholder}
                </span>
                <AlignLeftIcon className="mt-3 ml-1 size-3.5 shrink-0 text-muted-foreground" />
              </div>
              <button
                type="button"
                aria-label="Remove row"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setInitialRows(initialRows - 1)}
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-secondary hover:text-foreground"
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
