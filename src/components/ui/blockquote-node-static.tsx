import { SlateElement } from "platejs/static";
import type { SlateElementProps } from "platejs/static";

export const BlockquoteElementStatic = (props: SlateElementProps) => (
  <SlateElement as="blockquote" className="my-1 border-l-2 pl-6 italic" {...props} />
);
