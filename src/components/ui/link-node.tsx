import { getLinkAttributes } from "@platejs/link";
import type { TLinkElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export const LinkElement = (props: PlateElementProps<TLinkElement>) => (
  <PlateElement
    {...props}
    as="a"
    className="text-blue-600 underline decoration-blue-600 underline-offset-4 dark:text-blue-400 dark:decoration-blue-400"
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
