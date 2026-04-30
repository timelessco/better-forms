import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import { AlignLeftIcon } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormInputNode } from "@/hooks/use-form-input-node";
import { cn } from "@/lib/utils";

export const FormTextareaElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const placeholder = element.placeholder as string | undefined;
  const { focused, isSelected } = useFormInputNode(element);

  return (
    <PlateElement
      attributes={{ ...attributes, placeholder, "data-bf-input": "true" }}
      className={cn(
        "relative flex min-h-24 w-full max-w-[464px] cursor-text items-start gap-[4px] rounded-[8px] border-0 bg-[var(--color-gray-50)] pr-[8px] pl-[10px] text-sm caret-current shadow-[0_0_1px_rgba(0,0,0,0.54),0_1px_1px_rgba(0,0,0,0.06)] before:top-2.5",
        isSelected && focused && "ring-[3px] ring-ring/50",
      )}
      element={element}
      {...rest}
    >
      <span className="block min-w-px flex-1 pt-2.5 pb-2 text-muted-foreground/50 outline-none">
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
  );
};
