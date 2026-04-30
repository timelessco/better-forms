import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from "@/components/ui/icons";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useEditorSelector } from "platejs/react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  const [isOpen, setIsOpen] = React.useState(false);

  // Get label from element property (fallback to children for backwards compat)
  const label =
    (element.label as string) ??
    extractTextFromChildren(element.children as Array<{ text?: string }>);

  // Local state for input - prevents re-render on every keystroke
  const [inputValue, setInputValue] = React.useState(label);

  const displayText = label.trim() || placeholder;

  const handleLabelChange = React.useCallback(
    (newLabel: string) => {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes({ label: newLabel }, { at: path });
      }
    },
    [editor, element],
  );

  const saveAndClose = React.useCallback(() => {
    handleLabelChange(inputValue);
    setIsOpen(false);
  }, [handleLabelChange, inputValue]);

  const buttonLabelId = React.useId();

  const handlePopoverOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) setInputValue(label);
      setIsOpen(open);
    },
    [label],
  );

  const handleGearMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleGearClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
  }, []);

  const handlePopoverMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleInputBlur = React.useCallback(() => {
    handleLabelChange(inputValue);
  }, [handleLabelChange, inputValue]);

  const handleInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        saveAndClose();
      }
    },
    [saveAndClose],
  );

  const handleInputMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleInputClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const GearIcon = (
    <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 opacity-0 group-hover:opacity-100"
            aria-label="Button settings"
            onMouseDown={handleGearMouseDown}
            onClick={handleGearClick}
          />
        }
      >
        <SettingsIcon className="h-4 w-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        className="w-64 border p-4"
        side={isPrevious ? "right" : "left"}
        align="start"
        onMouseDown={handlePopoverMouseDown}
      >
        <div className="space-y-2">
          <Label htmlFor={buttonLabelId} className="text-sm">
            Button label
          </Label>
          <Input
            id={buttonLabelId}
            value={inputValue}
            placeholder={placeholder}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            onMouseDown={handleInputMouseDown}
            onClick={handleInputClick}
          />
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <PlateElement
      className={cn("m-0 px-0", isPrevious ? "float-left" : "flex overflow-hidden")}
      {...props}
      attributes={{ ...props.attributes, "data-bf-chrome": "" }}
    >
      {/* Hidden children to maintain Slate structure */}
      <span className="hidden">{children}</span>
      {/* Non-editable button visual - onMouseDown prevents cursor placement */}
      <div
        className={cn(
          "group inline-flex items-center gap-1 py-2.5",
          !isPrevious && isMultiStep && "ml-auto",
        )}
        contentEditable={false}
        role="presentation"
        aria-hidden="true"
        onMouseDown={handleGearMouseDown}
      >
        {/* Gear icon on left when button is right-aligned (so button touches right edge) */}
        {!isPrevious && isMultiStep && GearIcon}
        <span
          className={cn(
            "inline-flex h-8 cursor-default items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors select-none",
            isPrevious
              ? "border border-input bg-background text-foreground shadow-xs"
              : "bg-primary text-primary-foreground",
          )}
        >
          {isPrevious && <ChevronLeftIcon className="h-4 w-4" />}
          <span>{displayText}</span>
          {buttonRole === "submit" && <CheckIcon className="h-4 w-4" />}
          {buttonRole === "next" && <ChevronRightIcon className="h-4 w-4" />}
        </span>
        {/* Gear icon on right when button is left-aligned (so button touches left edge) */}
        {(isPrevious || !isMultiStep) && GearIcon}
      </div>
    </PlateElement>
  );
};
