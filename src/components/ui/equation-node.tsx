import { useEquationElement, useEquationInput } from "@platejs/math/react";
import { BlockSelectionPlugin } from "@platejs/selection/react";
import { CornerDownLeftIcon, RadicalIcon } from "@/components/ui/icons";
import type { TEquationElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import {
  createPrimitiveComponent,
  PlateElement,
  useEditorRef,
  useEditorSelector,
  useElement,
  useReadOnly,
  useSelected,
} from "platejs/react";
import * as React from "react";
import TextareaAutosize from "react-textarea-autosize";
import type { TextareaAutosizeProps } from "react-textarea-autosize";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const EquationElement = (props: PlateElementProps<TEquationElement>) => {
  const selected = useSelected();
  const [open, setOpen] = React.useState(selected);
  const katexRef = React.useRef<HTMLDivElement | null>(null);

  useEquationElement({
    element: props.element,
    katexRef,
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

  return (
    <PlateElement className="my-1" {...props}>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              className={cn(
                "group flex h-auto cursor-pointer items-center justify-center rounded-sm select-none hover:bg-primary/10 data-[selected=true]:bg-primary/10",
                props.element.texExpression.length === 0 ? "bg-muted p-3 pr-9" : "px-2 py-1",
              )}
              data-selected={selected}
            />
          }
        >
          {props.element.texExpression.length > 0 ? (
            <span ref={katexRef} />
          ) : (
            <div className="flex h-7 w-full items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
              <RadicalIcon className="size-6 text-muted-foreground/80" />
              <div>Add a Tex equation</div>
            </div>
          )}
        </PopoverTrigger>

        <EquationPopoverContent
          open={open}
          placeholder={
            "f(x) = \\begin{cases}\n  x^2, &\\quad x > 0 \\\\\n  0, &\\quad x = 0 \\\\\n  -x^2, &\\quad x < 0\n\\end{cases}"
          }
          isInline={false}
          setOpen={setOpen}
        />
      </Popover>

      {props.children}
    </PlateElement>
  );
};

export const InlineEquationElement = (props: PlateElementProps<TEquationElement>) => {
  const element = props.element;
  const katexRef = React.useRef<HTMLDivElement | null>(null);
  const selected = useSelected();
  const isCollapsed = useEditorSelector((editor) => editor.api.isCollapsed(), []);
  const [open, setOpen] = React.useState(selected && isCollapsed);

  const effectiveOpen = open || (selected && isCollapsed);

  useEquationElement({
    element,
    katexRef,
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

  return (
    <PlateElement
      {...props}
      className={cn("mx-1 inline-block rounded-sm select-none [&_.katex-display]:my-0!")}
    >
      <Popover open={effectiveOpen} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger
          nativeButton={false}
          render={
            <div
              className={cn(
                'after:absolute after:inset-0 after:-top-0.5 after:-left-1 after:z-1 after:h-[calc(100%+4px)] after:w-[calc(100%+8px)] after:rounded-sm after:content-[""]',
                "h-6",
                ((element.texExpression.length > 0 && effectiveOpen) || selected) &&
                  "after:bg-brand/15",
                element.texExpression.length === 0 &&
                  "text-muted-foreground after:bg-neutral-500/10",
              )}
              contentEditable={false}
            />
          }
        >
          <span
            ref={katexRef}
            className={cn(element.texExpression.length === 0 && "hidden", "font-mono")}
          />
          {element.texExpression.length === 0 && (
            <span>
              <RadicalIcon className="mr-1 inline-block h-[19px] w-4 py-[1.5px] align-text-bottom" />
              New equation
            </span>
          )}
        </PopoverTrigger>

        <EquationPopoverContent
          className="my-auto"
          open={effectiveOpen}
          placeholder="E = mc^2"
          setOpen={setOpen}
          isInline
        />
      </Popover>

      {props.children}
    </PlateElement>
  );
};

const EquationInput = createPrimitiveComponent(TextareaAutosize)({
  propsHook: useEquationInput,
});

const EquationPopoverContent = ({
  className,
  isInline,
  open,
  setOpen,
  ...props
}: {
  isInline: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
} & TextareaAutosizeProps) => {
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  const element = useElement<TEquationElement>();

  if (readOnly) return null;
  const onClose = () => {
    setOpen(false);

    if (isInline) {
      editor.tf.select(element, { focus: true, next: true });
    } else {
      editor.getApi(BlockSelectionPlugin).blockSelection.set(element.id as string);
    }
  };

  return (
    <PopoverContent className="flex w-72 gap-2 border p-4" contentEditable={false}>
      <EquationInput
        className={cn("max-h-[50vh] grow resize-none p-2 text-sm", className)}
        state={{ isInline, open, onClose }}
        autoFocus
        {...props}
      />

      <Button
        variant="secondary"
        className="px-3"
        suffix={<CornerDownLeftIcon className="size-3.5" />}
        onClick={onClose}
      >
        Done
      </Button>
    </PopoverContent>
  );
};
