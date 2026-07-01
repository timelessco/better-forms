import { getLinkAttributes } from "@platejs/link";
import type { TLinkElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export const LinkElement = (props: PlateElementProps<TLinkElement>) => (
  <PlateElement
    {...props}
    as="a"
    // Inherit the body text color (themed forms set --bf-foreground); underline uses currentColor.
    className="text-inherit underline underline-offset-4"
    attributes={{
      ...props.attributes,
      ...getLinkAttributes(props.editor, props.element),
      onMouseOver: (e) => {
        e.stopPropagation();
      },
    }}
  >
    {props.children}
  </PlateElement>
);
