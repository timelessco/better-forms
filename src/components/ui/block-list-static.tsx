import { isOrderedList } from "@platejs/list";
import { CheckIcon } from "@/components/ui/icons";
import type { RenderStaticNodeWrapper, TListElement } from "platejs";
import type { SlateRenderElementProps } from "platejs/static";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TodoMarkerStatic = (props: SlateRenderElementProps) => {
  const checked = props.element.checked as boolean;

  return (
    <div contentEditable={false}>
      <Button
        variant="ghost"
        className={cn(
          "peer pointer-events-none absolute top-1/2 -left-6 size-4 h-4 w-4 shrink-0 -translate-y-1/2 rounded-sm border border-primary bg-background p-0 ring-offset-background hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
          props.className,
        )}
        data-state={checked ? "checked" : "unchecked"}
      >
        <div className={cn("flex items-center justify-center text-current")}>
          {checked && <CheckIcon className="size-4" />}
        </div>
      </Button>
    </div>
  );
};

const TodoLiStatic = (props: SlateRenderElementProps) => (
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
    Li: React.FC<SlateRenderElementProps>;
    Marker: React.FC<SlateRenderElementProps>;
  }
> = {
  todo: {
    Li: TodoLiStatic,
    Marker: TodoMarkerStatic,
  },
};

export const BlockListStatic: RenderStaticNodeWrapper = (props) => {
  if (!props.element.listStyleType) return;

  return (innerProps) => <List {...innerProps} />;
};

const List = (props: SlateRenderElementProps) => {
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
