import { PlateElement } from "platejs/react";
import type { PlateElementProps } from "platejs/react";

import { LabelRequiredBadge } from "@/components/ui/required-badge-button";

export const BlockquoteElement = (props: PlateElementProps) => (
  <PlateElement as="blockquote" className="relative my-1 border-l-2 pl-6 italic" {...props}>
    {props.children}
    <LabelRequiredBadge labelElement={props.element} />
  </PlateElement>
);
