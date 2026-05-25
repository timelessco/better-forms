import type { PlateLeafProps } from "platejs/react";
import { PlateLeaf } from "platejs/react";

export const HighlightLeaf = (props: PlateLeafProps) => (
  <PlateLeaf {...props} as="mark" className="bg-highlight/30 text-inherit">
    {props.children}
  </PlateLeaf>
);
