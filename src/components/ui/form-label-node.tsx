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
      // Label color follows Body text (--bf-foreground) so it matches the preview/live label; falls
      // back to gray-800 when uncustomized. Title keeps its own Customize slot (--bf-title-color).
      className="relative m-0 cursor-text px-0 text-base font-[450] text-[var(--bf-foreground,var(--color-gray-800))] caret-current"
      {...props}
    >
      <div className="flex items-center gap-1">
        {isEmpty && placeholder && isSelected && (
          <span
            className="pointer-events-none absolute text-muted-foreground/50 select-none"
            data-bf-placeholder
          >
            {placeholder}
          </span>
        )}
        <span className="min-w-px outline-none">{children}</span>
      </div>
      <LabelRequiredBadge labelElement={element} />
    </PlateElement>
  );
};
