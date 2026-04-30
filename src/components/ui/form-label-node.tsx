import type { PlateElementProps } from "platejs/react";

import { PlateElement, useSelected } from "platejs/react";

import { LabelRequiredBadge } from "@/components/ui/required-badge-button";

export const FormLabelElement = ({ children, ...props }: PlateElementProps) => {
  const { editor, element } = props;
  const placeholder = element.placeholder as string | undefined;
  const isEmpty = editor.api.isEmpty(element);
  const isSelected = useSelected();

  return (
    <PlateElement
      className="relative m-0 cursor-text px-0 text-sm text-foreground caret-current"
      {...props}
    >
      <div className="flex items-center gap-1">
        {isEmpty && placeholder && isSelected && (
          <span className="pointer-events-none absolute text-muted-foreground/90 select-none">
            {placeholder}
          </span>
        )}
        <span className="min-w-px outline-none">{children}</span>
      </div>
      <LabelRequiredBadge labelElement={element} />
    </PlateElement>
  );
};
