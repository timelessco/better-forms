import { getLinkAttributes } from "@platejs/link";

import type { TLinkElement } from "platejs";
import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";

export const LinkElementStatic = (props: SlateElementProps<TLinkElement>) => (
  <SlateElement
    {...props}
    as="a"
    className="text-blue-600 underline decoration-blue-600 underline-offset-4 dark:text-blue-400 dark:decoration-blue-400"
    attributes={{
      ...props.attributes,
      ...getLinkAttributes(props.editor, props.element),
    }}
  >
    {props.children}
  </SlateElement>
);
