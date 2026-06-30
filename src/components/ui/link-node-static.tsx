import { getLinkAttributes } from "@platejs/link";

import type { TLinkElement } from "platejs";
import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";

export const LinkElementStatic = (props: SlateElementProps<TLinkElement>) => (
  <SlateElement
    {...props}
    as="a"
    // Inherit the body text color (themed forms set --bf-foreground); underline uses currentColor.
    className="text-inherit underline underline-offset-4"
    attributes={{
      ...props.attributes,
      ...getLinkAttributes(props.editor, props.element),
    }}
  >
    {props.children}
  </SlateElement>
);
