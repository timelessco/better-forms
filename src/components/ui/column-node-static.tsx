import type { TColumnElement } from "platejs";
import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";

export const ColumnElementStatic = (props: SlateElementProps<TColumnElement>) => {
  const { width } = props.element;

  return (
    <div className="group/column relative" style={{ width: width ?? "100%" }}>
      <SlateElement
        className="h-full px-2 pt-2 group-first/column:pl-0 group-last/column:pr-0"
        {...props}
      >
        <div className="relative h-full border border-transparent p-1.5">{props.children}</div>
      </SlateElement>
    </div>
  );
};

export const ColumnGroupElementStatic = (props: SlateElementProps) => (
  <SlateElement className="mb-2" {...props}>
    <div className="flex size-full rounded">{props.children}</div>
  </SlateElement>
);
