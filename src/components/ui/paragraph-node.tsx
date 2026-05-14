import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

import { LabelRequiredBadge } from "@/components/ui/required-badge-button";
import { cn } from "@/lib/utils";

export const ParagraphElement = (props: PlateElementProps) => (
  <PlateElement {...props} className={cn("relative m-0 px-0")}>
    {props.children}
    <LabelRequiredBadge labelElement={props.element} />
  </PlateElement>
);
