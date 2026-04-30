import { getEquationHtml } from "@platejs/math";
import { RadicalIcon } from "@/components/ui/icons";
import type { TEquationElement } from "platejs";
import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";
import * as React from "react";

import { cn } from "@/lib/utils";

export const EquationElementStatic = (props: SlateElementProps<TEquationElement>) => {
  const { element } = props;

  const html = getEquationHtml({
    element,
    options: {
      displayMode: true,
      errorColor: "#cc0000",
      fleqn: false,
      leqno: false,
      macros: { "\\f": "#1f(#2)" },
      output: "htmlAndMathml",
      strict: "warn",
      throwOnError: false,
      trust: false,
    },
  });
  const renderedNodes = React.useMemo(() => parseMathHtml(html), [html]);

  return (
    <SlateElement className="my-1" {...props}>
      <div
        className={cn(
          "group flex items-center justify-center rounded-sm select-none hover:bg-primary/10 data-[selected=true]:bg-primary/10",
          element.texExpression.length === 0 ? "bg-muted p-3 pr-9" : "px-2 py-1",
        )}
      >
        {element.texExpression.length > 0 ? (
          <span className="flex min-h-[1em] items-center" aria-hidden>
            {renderedNodes?.length ? renderedNodes : element.texExpression}
          </span>
        ) : (
          <div className="flex h-7 w-full items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
            <RadicalIcon className="size-6 text-muted-foreground/80" />
            <div>Add a Tex equation</div>
          </div>
        )}
      </div>
      {props.children}
    </SlateElement>
  );
};

export const InlineEquationElementStatic = (props: SlateElementProps<TEquationElement>) => {
  const html = getEquationHtml({
    element: props.element,
    options: {
      displayMode: true,
      errorColor: "#cc0000",
      fleqn: false,
      leqno: false,
      macros: { "\\f": "#1f(#2)" },
      output: "htmlAndMathml",
      strict: "warn",
      throwOnError: false,
      trust: false,
    },
  });
  const renderedNodes = React.useMemo(() => parseMathHtml(html), [html]);

  return (
    <SlateElement
      {...props}
      className="inline-block rounded-sm select-none [&_.katex-display]:my-0"
    >
      <div
        className={cn(
          'after:absolute after:inset-0 after:-top-0.5 after:-left-1 after:z-1 after:h-[calc(100%)+4px] after:w-[calc(100%+8px)] after:rounded-sm after:content-[""]',
          "h-6",
          props.element.texExpression.length === 0 &&
            "text-muted-foreground after:bg-neutral-500/10",
        )}
      >
        <span className={cn(props.element.texExpression.length === 0 && "hidden", "font-mono")}>
          {renderedNodes?.length ? renderedNodes : props.element.texExpression}
        </span>
      </div>
      {props.children}
    </SlateElement>
  );
};

const ATTRIBUTE_NAME_MAP: Record<string, string> = {
  class: "className",
  for: "htmlFor",
};

const parseMathHtml = (html: string): React.ReactNode[] | null => {
  if (typeof DOMParser === "undefined") {
    return null;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  const nodes = Array.from(document.body.childNodes)
    .map((node, index) => convertNodeToReact(node, `${index}`))
    .filter((node): node is React.ReactNode => node !== null);

  return nodes.length ? nodes : null;
};

const convertNodeToReact = (node: ChildNode, key: string): React.ReactNode | null => {
  if (node.nodeType === 3) {
    return node.textContent;
  }

  if (node.nodeType !== 1) {
    return null;
  }

  const element = node as Element;
  const props = convertAttributes(element);
  const children = Array.from(element.childNodes)
    .map((child, index) => convertNodeToReact(child, `${key}-${index}`))
    .filter((child): child is React.ReactNode => child !== null);
  const content =
    children.length === 0 ? undefined : children.length === 1 ? children[0] : children;

  return React.createElement(element.tagName.toLowerCase(), { ...props, key }, content);
};

const convertAttributes = (element: Element): Record<string, unknown> => {
  const props: Record<string, unknown> = {};

  Array.from(element.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) return;

    if (name === "style") {
      const styleValue = parseStyleString(attr.value);
      if (Object.keys(styleValue).length) {
        props.style = {
          ...(props.style as Record<string, string>),
          ...styleValue,
        };
      }
      return;
    }

    const propName = ATTRIBUTE_NAME_MAP[name] ?? attr.name;
    props[propName] = attr.value;
  });

  return props;
};

const parseStyleString = (style: string): Record<string, string> =>
  style.split(";").reduce<Record<string, string>>((acc, declaration) => {
    const [property, ...rest] = declaration.split(":");
    if (!property || !rest.length) {
      return acc;
    }

    const value = rest.join(":").trim();
    if (!value) {
      return acc;
    }

    const camelCased = property.trim().replace(/-([a-z])/g, (_, char) => char.toUpperCase());

    acc[camelCased] = value;
    return acc;
  }, {});
