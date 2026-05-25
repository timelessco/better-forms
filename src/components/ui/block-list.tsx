import { isOrderedList } from "@platejs/list";
import { useTodoListElement, useTodoListElementState } from "@platejs/list/react";
import type { TListElement } from "platejs";
import { useReadOnly } from "platejs/react";
import type { PlateElementProps, RenderNodeWrapper } from "platejs/react";
import type React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const TodoMarker = (props: PlateElementProps) => {
  const state = useTodoListElementState({ element: props.element });
  const { checkboxProps } = useTodoListElement(state);
  const readOnly = useReadOnly();

  return (
    <div contentEditable={false}>
      <Checkbox
        className={cn(
          "absolute top-1/2 -left-6 -translate-y-1/2",
          readOnly && "pointer-events-none",
        )}
        {...checkboxProps}
      />
    </div>
  );
};

const TodoLi = (props: PlateElementProps) => (
  <li
    className={cn(
      "list-none",
      (props.element.checked as boolean) && "text-muted-foreground line-through",
    )}
  >
    {props.children}
  </li>
);

const config: Record<
  string,
  {
    Li: React.FC<PlateElementProps>;
    Marker: React.FC<PlateElementProps>;
  }
> = {
  todo: {
    Li: TodoLi,
    Marker: TodoMarker,
  },
};

export const BlockList: RenderNodeWrapper = (props) => {
  if (!props.element.listStyleType) return;

  return (innerProps) => <List {...innerProps} />;
};

const List = (props: PlateElementProps) => {
  const { listStart, listStyleType } = props.element as TListElement;
  const { Li, Marker } = config[listStyleType] ?? {};
  const ListTag = isOrderedList(props.element) ? "ol" : "ul";

  return (
    <ListTag className="relative m-0 p-0" style={{ listStyleType }} start={listStart}>
      {Marker && <Marker {...props} />}
      {Li ? <Li {...props} /> : <li>{props.children}</li>}
    </ListTag>
  );
};
