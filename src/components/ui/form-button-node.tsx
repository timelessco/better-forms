import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useEditorSelector } from "platejs/react";
import * as React from "react";
import {
  findNextFocusTarget,
  findPrevFocusTarget,
  goToFocusTarget,
} from "@/components/editor/plugins/form-blocks-utils";
import { cn } from "@/lib/utils";

export type ButtonRole = "next" | "previous" | "submit";

export interface FormButtonElementData {
  type: "formButton";
  buttonRole: ButtonRole;
  label?: string;
  children: [{ text: string }];
}

export const createFormButtonNode = (role: ButtonRole, text?: string): FormButtonElementData => {
  const defaultText = role === "next" ? "Next" : role === "previous" ? "Previous" : "Submit";
  return {
    type: "formButton",
    buttonRole: role,
    label: text ?? defaultText,
    children: [{ text: "" }],
  };
};

const getPlaceholderForRole = (role: ButtonRole): string => {
  switch (role) {
    case "next":
      return "Next";
    case "previous":
      return "Previous";
    case "submit":
      return "Submit";
    default:
      return "Button";
  }
};

const extractTextFromChildren = (children: Array<{ text?: string }>): string => {
  if (!Array.isArray(children)) return "";
  return children.map((child) => child.text || "").join("");
};

export const FormButtonElement = ({ children, ...props }: PlateElementProps) => {
  const { element } = props;
  const editor = useEditorRef();
  const buttonRole = (element.buttonRole as ButtonRole) ?? "submit";
  const placeholder = getPlaceholderForRole(buttonRole);

  const isPrevious = buttonRole === "previous";
  const isMultiStep = useEditorSelector(
    (ed) => ed.children.some((node) => (node as { type?: string }).type === "pageBreak"),
    [],
  );

  // Get label from element property (fallback to children for backwards compat)
  const label =
    (element.label as string) ??
    extractTextFromChildren(element.children as Array<{ text?: string }>);

  // Inline-editable label: a native input (Slate ignores it — parent is contentEditable=false)
  // edits element.label directly, the same property the transform reads first. Local state controls
  // the input so it keeps the caret; synced back from the node on external changes (undo, etc.)
  // while the input isn't focused.
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = React.useState(label);
  React.useEffect(() => {
    if (document.activeElement !== inputRef.current) setInputValue(label);
  }, [label]);

  const writeLabel = React.useCallback(
    (next: string) => {
      const path = editor.api.findPath(element);
      if (path) editor.tf.setNodes({ label: next }, { at: path });
    },
    [editor, element],
  );

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      writeLabel(e.target.value);
    },
    [writeLabel],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      // Keep Plate's editor handlers off keys typed in the void node (incl. Backspace deleting it).
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        inputRef.current?.blur();
        return;
      }
      // Tab joins the button into the editor tab order: Previous → action button → next page.
      // preventDefault always — the final Submit (no page after) has no target, so Tab just stays.
      if (e.key === "Tab") {
        e.preventDefault();
        const path = editor.api.findPath(element);
        if (!path) return;
        const target = e.shiftKey
          ? findPrevFocusTarget(editor, path[0])
          : findNextFocusTarget(editor, path[0]);
        if (target) goToFocusTarget(editor, target, e.shiftKey);
      }
    },
    [editor, element],
  );

  // Stop pointer events from reaching Slate (cursor placement / block selection) so the input
  // focuses normally. Don't preventDefault — that would block focus.
  const stopPointer = React.useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

  // Chrome (the py-2.5 gutter around the pill) shouldn't place a Slate caret on mousedown.
  const handleChromeMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <PlateElement
      className={cn("m-0 px-0", isPrevious ? "float-left" : "flex overflow-hidden")}
      {...props}
      attributes={{ ...props.attributes, "data-bf-chrome": "" }}
    >
      {/* Hidden children to maintain Slate structure */}
      <span className="hidden">{children}</span>
      <div
        className={cn(
          "group inline-flex items-center gap-1 py-2.5",
          !isPrevious && isMultiStep && "ml-auto",
        )}
        contentEditable={false}
        // presentation (not aria-hidden) keeps the inner input accessible while neutralizing the div.
        role="presentation"
        onMouseDown={handleChromeMouseDown}
      >
        {/* <label> so a click anywhere on the pill (icons/padding) natively focuses the input;
            stopPropagation (no preventDefault) lets that native focus through past the chrome guard. */}
        <label
          data-bf-button={isPrevious ? undefined : ""}
          onMouseDown={stopPointer}
          className={cn(
            "inline-flex h-8 cursor-text items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors select-none",
            isPrevious
              ? "border border-input bg-background text-foreground shadow-xs"
              : "bg-primary text-primary-foreground",
          )}
        >
          {isPrevious && <ChevronLeftIcon className="size-4" />}
          <input
            ref={inputRef}
            value={inputValue}
            placeholder={placeholder}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onMouseDown={stopPointer}
            onPointerDown={stopPointer}
            onClick={stopPointer}
            aria-label="Button label"
            className="field-sizing-content min-w-[2ch] cursor-text bg-transparent text-center text-inherit outline-none placeholder:text-current/60"
          />
          {buttonRole === "submit" && <CheckIcon className="size-4" />}
          {buttonRole === "next" && <ChevronRightIcon className="size-4" />}
        </label>
      </div>
    </PlateElement>
  );
};
