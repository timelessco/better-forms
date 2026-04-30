import { CopyIcon, EyeOffIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import {
  BLOCK_CONTEXT_MENU_ID,
  BlockMenuPlugin,
  BlockSelectionPlugin,
} from "@platejs/selection/react";
import { KEYS } from "platejs";
import { useEditorPlugin, useEditorSelector, useHotkeys, usePluginOption } from "platejs/react";
import * as React from "react";

import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEditorTheme } from "@/contexts/editor-theme-context";
import {
  FILE_SUBTYPES,
  FILE_TYPE_CATEGORY_LABELS,
  isFileTypeCategory,
} from "@/lib/form-schema/file-upload-types";
import type { FileTypeCategory } from "@/lib/form-schema/file-upload-types";
import { ALLOWED_LABEL_TYPES, FORM_INPUT_NODE_TYPES } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";

type BlockFieldType =
  | "textLike" // formInput, formTextarea, formEmail, formPhone, formLink
  | "formNumber"
  | "formDate"
  | "formTime"
  | "formFileUpload"
  | "optionCheckbox" // formOptionItem variant="checkbox"
  | "optionMultiChoice" // formOptionItem variant="multiChoice"
  | "optionRanking" // formOptionItem variant="ranking"
  | "formMultiSelect" // formMultiSelectInput
  | "formButton"
  | "static"
  | "unknown";

const TEXT_LIKE_TYPES = new Set([
  "formInput",
  "formTextarea",
  "formEmail",
  "formPhone",
  "formLink",
]);

const getFieldType = (node: { type?: string; variant?: string } | undefined): BlockFieldType => {
  if (!node?.type) return "unknown";
  const t = node.type;
  if (TEXT_LIKE_TYPES.has(t)) return "textLike";
  if (t === "formNumber") return "formNumber";
  if (t === "formDate") return "formDate";
  if (t === "formTime") return "formTime";
  if (t === "formFileUpload") return "formFileUpload";
  if (t === "formMultiSelectInput") return "formMultiSelect";
  if (t === "formOptionItem") {
    const v = node.variant || "checkbox";
    if (v === "multiChoice") return "optionMultiChoice";
    if (v === "ranking") return "optionRanking";
    return "optionCheckbox";
  }
  if (t === "formButton") return "formButton";
  if (["h1", "h2", "h3", "p", "blockquote", "hr"].includes(t)) return "static";
  return "unknown";
};

// Returns the trimmed text of a node, or empty string if absent / blank.
// Callers chain fallbacks (label → input → "Untitled") so empty must be empty.
const extractLabelText = (node: { children?: Array<{ text?: string }> }): string => {
  if (!node.children) return "";
  return node.children
    .map((child) => child.text || "")
    .join("")
    .trim();
};

const stopMouseEventPropagation = (e: React.MouseEvent) => {
  e.stopPropagation();
};

const stopKeyEventPropagation = (e: React.KeyboardEvent) => {
  e.stopPropagation();
};

type NumberRowProps = {
  label: string;
  value: number | undefined;
  onChange: (raw: string) => void;
  min?: number;
  max?: number;
  suffix?: string;
  /** Shown as placeholder when value is unset — hints the effective default
   *  without actually persisting it. Pick per-field (see call sites). */
  defaultHint?: number;
};

// Dropdown row: label on the left, compact number input on the right.
// Uses DropdownMenuItem so padding + hover match the Required/File-types
// rows above; Input is stripped to a subtle bordered box (no shadow) to
// blend into the menu instead of standing out.
const NumberRow = ({ label, value, onChange, min, max, suffix, defaultHint }: NumberRowProps) => (
  <DropdownMenuItem closeOnClick={false} onPointerDown={stopMouseEventPropagation}>
    <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">{label}</span>
    <Input
      type="number"
      min={min}
      max={max}
      value={value ?? ""}
      placeholder={defaultHint !== undefined ? String(defaultHint) : undefined}
      onChange={(e) => onChange(e.target.value || "0")}
      onKeyDown={stopKeyEventPropagation}
      onClick={stopMouseEventPropagation}
      aria-label={label}
      className="h-[20px] w-[48px] shrink-0 rounded-[4px] border border-transparent bg-transparent px-1 text-right text-[12px] shadow-none placeholder:text-muted-foreground/60 focus:border-border/70 focus-visible:border-border/70 focus-visible:ring-0 dark:border-transparent dark:focus:border-border/70 dark:focus-visible:border-border/70"
    />
    {suffix && <span className="shrink-0 text-[11px] text-muted-foreground/80">{suffix}</span>}
  </DropdownMenuItem>
);

type FileExtensionToggleRowProps = {
  category: FileTypeCategory;
  selected: string[] | undefined;
  onToggle: (subtypeId: string) => void;
};

// Empty `selected` ⇒ every subtype is implicitly enabled, so the pills render
// as active until the user starts narrowing down.
const FileExtensionToggleRow = ({ category, selected, onToggle }: FileExtensionToggleRowProps) => {
  const open = category !== "all";
  const subtypes = open ? FILE_SUBTYPES[category] : [];
  const allEnabled = !selected || selected.length === 0;
  const isActive = (id: string) => allEnabled || (selected?.includes(id) ?? false);

  return (
    <Collapsible open={open}>
      <CollapsibleContent>
        <div className="px-2 pt-0.5 pb-1">
          <div className="flex h-[28px] items-stretch overflow-hidden rounded-[6px] border border-border/60 bg-transparent">
            {subtypes.map((subtype, i) => {
              const active = isActive(subtype.id);
              return (
                <React.Fragment key={subtype.id}>
                  {i > 0 && <span aria-hidden className="w-px self-stretch bg-border/60" />}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggle(subtype.id);
                    }}
                    onPointerDown={stopMouseEventPropagation}
                    aria-pressed={active}
                    className={cn(
                      "flex-1 text-[11px] font-medium tracking-wide uppercase transition-colors",
                      active
                        ? "bg-(--color-gray-alpha-100) text-foreground"
                        : "text-muted-foreground/50 hover:bg-(--color-gray-alpha-100)/50 hover:text-foreground",
                    )}
                  >
                    {subtype.label}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const BlockMenu = ({ children }: { children: React.ReactNode }) => {
  const { api, editor } = useEditorPlugin(BlockMenuPlugin);
  const openId = usePluginOption(BlockMenuPlugin, "openId");
  const { themeVars, hasCustomization } = useEditorTheme();
  const isOpen = openId === BLOCK_CONTEXT_MENU_ID;

  const position = usePluginOption(BlockMenuPlugin, "position");
  const { x, y } = position ?? { x: 0, y: 0 };

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [fieldName, setFieldName] = React.useState("");
  const [buttonText, setButtonText] = React.useState("");
  const [turnIntoOpen, setTurnIntoOpen] = React.useState(false);
  const blockMenuTriggerRef = React.useRef<HTMLDivElement | null>(null);
  const turnIntoCloseTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const selectedNodes = useEditorSelector(
    (ed) => {
      if (!isOpen) return [];
      try {
        return ed.getApi(BlockSelectionPlugin).blockSelection.getNodes();
      } catch {
        return [];
      }
    },
    [isOpen],
  );

  const firstNode = selectedNodes[0]?.[0] as
    | {
        type?: string;
        variant?: string;
        required?: boolean;
        placeholder?: string;
        minLength?: number;
        maxLength?: number;
        defaultValue?: string;
        buttonText?: string;
        children?: Array<{ text?: string }>;
        minValue?: number;
        maxValue?: number;
        allowDecimals?: boolean;
        maxFileSize?: number;
        maxFiles?: number;
        allowedFileTypes?: string;
        allowedFileExtensions?: string[];
        minSelections?: number;
        maxSelections?: number;
        randomizeOrder?: boolean;
        allowOther?: boolean;
      }
    | undefined;
  const firstPath = selectedNodes[0]?.[1];

  const nodeType = firstNode?.type;

  const labelNode = React.useMemo(() => {
    if (nodeType === "formLabel" || nodeType === "formButton") return firstNode;
    if (FORM_INPUT_NODE_TYPES.has(nodeType ?? "") && firstPath) {
      const prevPath = [...firstPath];
      prevPath[prevPath.length - 1] -= 1;
      try {
        const prev = editor.api.node(prevPath);
        if (prev && ALLOWED_LABEL_TYPES.has(prev[0]?.type as string)) {
          return prev[0] as typeof firstNode;
        }
      } catch {}
    }
    return null;
  }, [nodeType, firstNode, firstPath, editor]);

  const inputNode = React.useMemo(() => {
    if (FORM_INPUT_NODE_TYPES.has(nodeType ?? "")) return firstNode;
    if (ALLOWED_LABEL_TYPES.has(nodeType ?? "") && firstPath) {
      const nextPath = [...firstPath];
      nextPath[nextPath.length - 1] += 1;
      try {
        const next = editor.api.node(nextPath);
        if (next && FORM_INPUT_NODE_TYPES.has(next[0]?.type as string)) {
          return next[0] as typeof firstNode;
        }
      } catch {}
    }
    return null;
  }, [nodeType, firstNode, firstPath, editor]);

  const fieldType = React.useMemo(() => {
    if (inputNode) return getFieldType(inputNode as { type?: string; variant?: string });
    return getFieldType(firstNode as { type?: string; variant?: string });
  }, [inputNode, firstNode]);

  const getInputPath = React.useCallback(() => {
    if (!firstPath) return null;
    if (FORM_INPUT_NODE_TYPES.has(nodeType ?? "")) return firstPath;
    if (nodeType === "formOptionItem") return firstPath;
    if (ALLOWED_LABEL_TYPES.has(nodeType ?? "")) {
      const inputPath = [...firstPath];
      inputPath[inputPath.length - 1] += 1;
      return inputPath;
    }
    return null;
  }, [nodeType, firstPath]);

  const [wasOpen, setWasOpen] = React.useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    const labelText = labelNode ? extractLabelText(labelNode) : "";
    const inputText = firstNode ? extractLabelText(firstNode) : "";
    const label = labelText || inputText || "Untitled";
    setFieldName(label);
    setIsEditingName(false);
    setTurnIntoOpen(false);
    if (nodeType === "formButton") {
      setButtonText((firstNode?.buttonText as string) || "Submit");
    }
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  const handleToggleRequired = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const currentRequired = Boolean(inputNode?.required);
    editor.tf.setNodes({ required: !currentRequired }, { at: inputPath });
  }, [getInputPath, inputNode?.required, editor.tf]);

  const handleUpdateMinLength = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || 0;
      if (num === 0) {
        editor.tf.unsetNodes(["minLength"], { at: inputPath });
      } else {
        editor.tf.setNodes({ minLength: num }, { at: inputPath });
      }
    },
    [getInputPath, editor.tf],
  );

  const handleUpdateMaxLength = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || 0;
      if (num === 0) {
        editor.tf.unsetNodes(["maxLength"], { at: inputPath });
      } else {
        editor.tf.setNodes({ maxLength: num }, { at: inputPath });
      }
    },
    [getInputPath, editor.tf],
  );

  const handleUpdateMinValue = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || 0;
      if (num === 0) {
        editor.tf.unsetNodes(["minValue"], { at: inputPath });
      } else {
        editor.tf.setNodes({ minValue: num }, { at: inputPath });
      }
    },
    [getInputPath, editor.tf],
  );

  const handleUpdateMaxValue = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || 0;
      if (num === 0) {
        editor.tf.unsetNodes(["maxValue"], { at: inputPath });
      } else {
        editor.tf.setNodes({ maxValue: num }, { at: inputPath });
      }
    },
    [getInputPath, editor.tf],
  );

  const handleToggleAllowDecimals = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const current = Boolean(inputNode?.allowDecimals);
    if (current) {
      editor.tf.unsetNodes(["allowDecimals"], { at: inputPath });
    } else {
      editor.tf.setNodes({ allowDecimals: true }, { at: inputPath });
    }
  }, [getInputPath, inputNode?.allowDecimals, editor.tf]);

  const handleUpdateMaxFileSize = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || 10;
      editor.tf.setNodes({ maxFileSize: num }, { at: inputPath });
    },
    [getInputPath, editor.tf],
  );

  const handleUpdateMaxFiles = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || 0;
      if (num === 0) {
        editor.tf.unsetNodes(["maxFiles"], { at: inputPath });
      } else {
        editor.tf.setNodes({ maxFiles: num }, { at: inputPath });
      }
    },
    [getInputPath, editor.tf],
  );

  const handleUpdateAllowedFileTypes = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      editor.tf.setNodes({ allowedFileTypes: value }, { at: inputPath });
      editor.tf.unsetNodes(["allowedFileExtensions"], { at: inputPath });
    },
    [getInputPath, editor.tf],
  );

  const handleToggleFileExtension = React.useCallback(
    (subtypeId: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const category = isFileTypeCategory(inputNode?.allowedFileTypes)
        ? inputNode.allowedFileTypes
        : "all";
      if (category === "all") return;
      const allSubtypes = FILE_SUBTYPES[category].map((s) => s.id);
      const current = inputNode?.allowedFileExtensions;
      // Empty/undefined means "all selected" — materialize the full list
      // before applying the toggle so removing one keeps the rest.
      const selected =
        Array.isArray(current) && current.length > 0
          ? current.filter((id): id is string => typeof id === "string" && allSubtypes.includes(id))
          : allSubtypes;
      const next = selected.includes(subtypeId)
        ? selected.filter((id) => id !== subtypeId)
        : [...selected, subtypeId];
      if (next.length === 0) return;
      // When the user re-selects everything, drop the field so the default
      // ("all subtypes") representation persists in the document.
      if (next.length === allSubtypes.length) {
        editor.tf.unsetNodes(["allowedFileExtensions"], { at: inputPath });
        return;
      }
      editor.tf.setNodes({ allowedFileExtensions: next }, { at: inputPath });
    },
    [getInputPath, editor.tf, inputNode?.allowedFileTypes, inputNode?.allowedFileExtensions],
  );

  const handleUpdateMinSelections = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || 0;
      if (num === 0) {
        editor.tf.unsetNodes(["minSelections"], { at: inputPath });
      } else {
        editor.tf.setNodes({ minSelections: num }, { at: inputPath });
      }
    },
    [getInputPath, editor.tf],
  );

  const handleUpdateMaxSelections = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || 0;
      if (num === 0) {
        editor.tf.unsetNodes(["maxSelections"], { at: inputPath });
      } else {
        editor.tf.setNodes({ maxSelections: num }, { at: inputPath });
      }
    },
    [getInputPath, editor.tf],
  );

  const handleToggleRandomizeOrder = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const current = Boolean(inputNode?.randomizeOrder);
    if (current) {
      editor.tf.unsetNodes(["randomizeOrder"], { at: inputPath });
    } else {
      editor.tf.setNodes({ randomizeOrder: true }, { at: inputPath });
    }
  }, [getInputPath, inputNode?.randomizeOrder, editor.tf]);

  const handleToggleAllowOther = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const current = Boolean(inputNode?.allowOther);
    if (current) {
      editor.tf.unsetNodes(["allowOther"], { at: inputPath });
    } else {
      editor.tf.setNodes({ allowOther: true }, { at: inputPath });
    }
  }, [getInputPath, inputNode?.allowOther, editor.tf]);

  const handleToggleDefaultValue = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const hasDefault = inputNode?.defaultValue !== undefined;
    if (hasDefault) {
      editor.tf.unsetNodes(["defaultValue"], { at: inputPath });
    } else {
      editor.tf.setNodes({ defaultValue: "" }, { at: inputPath });
    }
  }, [getInputPath, inputNode?.defaultValue, editor.tf]);

  const handleUpdateDefaultValue = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      editor.tf.setNodes({ defaultValue: value }, { at: inputPath });
    },
    [getInputPath, editor.tf],
  );

  const handleUpdateButtonText = React.useCallback(
    (value: string) => {
      if (!firstPath || nodeType !== "formButton") return;
      setButtonText(value);

      editor.tf.withoutNormalizing(() => {
        editor.tf.insertNodes({ text: value }, { at: [...firstPath, 0], select: false });
        editor.tf.removeNodes({ at: [...firstPath, 1] });
      });

      editor.tf.setNodes({ buttonText: value }, { at: firstPath });
    },
    [firstPath, nodeType, editor.tf],
  );

  const handleDelete = React.useCallback(() => {
    editor.getTransforms(BlockSelectionPlugin).blockSelection.removeNodes();
    editor.tf.focus();
    api.blockMenu.hide();
  }, [editor, api.blockMenu]);

  const handleDuplicate = React.useCallback(() => {
    editor.getTransforms(BlockSelectionPlugin).blockSelection.duplicate();
    api.blockMenu.hide();
  }, [editor, api.blockMenu]);

  const handleTurnInto = React.useCallback(
    (type: string) => {
      editor
        .getApi(BlockSelectionPlugin)
        .blockSelection.getNodes()
        .forEach(([node, path]: [Record<string, unknown>, number[]]) => {
          if (node[KEYS.listType]) {
            editor.tf.unsetNodes([KEYS.listType, "indent"], {
              at: path,
            });
          }
          editor.tf.toggleBlock(type, { at: path });
        });
      api.blockMenu.hide();
    },
    [editor, api.blockMenu],
  );

  React.useEffect(() => {
    const node = blockMenuTriggerRef.current;
    if (!node) return;

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      api.blockMenu.show(BLOCK_CONTEXT_MENU_ID, {
        x: event.clientX,
        y: event.clientY,
      });
    };

    node.addEventListener("contextmenu", handleContextMenu);
    return () => {
      node.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [api.blockMenu]);

  useHotkeys(
    "delete, backspace",
    handleDelete,
    { enabled: isOpen && !isEditingName, preventDefault: true },
    [isOpen, isEditingName, handleDelete],
  );

  useHotkeys(
    "mod+d",
    handleDuplicate,
    { enabled: isOpen && !isEditingName, preventDefault: true },
    [isOpen, isEditingName, handleDuplicate],
  );

  useHotkeys(
    "mod+alt+h",
    () => api.blockMenu.hide(),
    { enabled: isOpen && !isEditingName, preventDefault: true },
    [isOpen, isEditingName, api.blockMenu],
  );

  useHotkeys(
    "mod+alt+l",
    () => api.blockMenu.hide(),
    { enabled: isOpen && !isEditingName, preventDefault: true },
    [isOpen, isEditingName, api.blockMenu],
  );

  const isRequired = Boolean(inputNode?.required);
  const hasDefaultValue = inputNode?.defaultValue !== undefined;
  const currentDefaultValue = inputNode?.defaultValue;

  const handleOpenChange = React.useCallback(
    (open: boolean, eventDetails: { reason?: string }) => {
      if (!open) {
        const { reason } = eventDetails;
        // Only close on deliberate dismissals, not focus-related events
        // that fire during submenu interactions
        if (reason === "outsidePress" || reason === "escapeKey" || reason === "itemPress") {
          api.blockMenu.hide();
        }
      }
    },
    [api.blockMenu],
  );

  const handleTurnIntoParagraph = React.useCallback(() => handleTurnInto(KEYS.p), [handleTurnInto]);
  const handleTurnIntoH1 = React.useCallback(() => handleTurnInto(KEYS.h1), [handleTurnInto]);
  const handleTurnIntoH2 = React.useCallback(() => handleTurnInto(KEYS.h2), [handleTurnInto]);
  const handleTurnIntoH3 = React.useCallback(() => handleTurnInto(KEYS.h3), [handleTurnInto]);
  const handleTurnIntoBlockquote = React.useCallback(
    () => handleTurnInto(KEYS.blockquote),
    [handleTurnInto],
  );

  const handleStopPropagation = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleInputKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  const handleDefaultValueChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleUpdateDefaultValue(e.target.value),
    [handleUpdateDefaultValue],
  );

  const handleButtonTextChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleUpdateButtonText(e.target.value),
    [handleUpdateButtonText],
  );

  const handleHideMenu = React.useCallback(() => {
    api.blockMenu.hide();
  }, [api.blockMenu]);

  // Submenu hover handlers — manually bridge trigger ↔ submenu content
  const handleTurnIntoPointerEnter = React.useCallback(() => {
    clearTimeout(turnIntoCloseTimer.current);
    setTurnIntoOpen(true);
  }, []);

  const handleTurnIntoPointerLeave = React.useCallback(() => {
    turnIntoCloseTimer.current = setTimeout(() => setTurnIntoOpen(false), 150);
  }, []);

  const virtualAnchor = React.useMemo(() => {
    if (!isOpen) return undefined;
    return {
      getBoundingClientRect: () => ({
        x,
        y,
        width: 0,
        height: 0,
        top: y,
        left: x,
        right: x,
        bottom: y,
        toJSON: () => ({}),
      }),
    };
  }, [isOpen, x, y]);

  return (
    <>
      <div ref={blockMenuTriggerRef}>{children}</div>

      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
        <DropdownMenuContent
          anchor={virtualAnchor}
          className={cn("w-[288px] p-1", hasCustomization && "bf-themed")}
          style={hasCustomization ? themeVars : undefined}
          align="start"
          sideOffset={8}
        >
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="flex-1 truncate text-[13px] text-foreground">{fieldName}</span>
          </div>
          <DropdownMenuSeparator />

          {fieldType !== "static" && fieldType !== "formButton" && fieldType !== "unknown" && (
            <DropdownMenuItem closeOnClick={false} onClick={handleToggleRequired}>
              <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
                Required
              </span>
              <Switch
                aria-label="Required"
                size="sm"
                checked={isRequired}
                onCheckedChange={handleToggleRequired}
                onClick={handleStopPropagation}
              />
            </DropdownMenuItem>
          )}

          {fieldType === "textLike" && (
            <>
              <DropdownMenuItem closeOnClick={false} onClick={handleToggleDefaultValue}>
                <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
                  Default answer
                </span>
                <Switch
                  aria-label="Default answer"
                  size="sm"
                  checked={hasDefaultValue}
                  onCheckedChange={handleToggleDefaultValue}
                  onClick={handleStopPropagation}
                />
              </DropdownMenuItem>
              {hasDefaultValue && (
                <div className="px-2 pb-2">
                  <Input
                    value={currentDefaultValue || ""}
                    onChange={handleDefaultValueChange}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Enter default value"
                    className="h-7 rounded-lg text-[13px]"
                    aria-label="Default value"
                  />
                </div>
              )}

              <NumberRow
                label="Min characters"
                value={inputNode?.minLength}
                onChange={handleUpdateMinLength}
                min={0}
                max={1000}
                defaultHint={0}
              />

              {inputNode?.type !== "formTextarea" && (
                <NumberRow
                  label="Max characters"
                  value={inputNode?.maxLength}
                  onChange={handleUpdateMaxLength}
                  min={0}
                  max={1000}
                  defaultHint={100}
                />
              )}

              <DropdownMenuSeparator />
            </>
          )}

          {fieldType === "formNumber" && (
            <>
              <DropdownMenuItem closeOnClick={false} onClick={handleToggleDefaultValue}>
                <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
                  Default answer
                </span>
                <Switch
                  aria-label="Default answer"
                  size="sm"
                  checked={hasDefaultValue}
                  onCheckedChange={handleToggleDefaultValue}
                  onClick={handleStopPropagation}
                />
              </DropdownMenuItem>
              {hasDefaultValue && (
                <div className="px-2 pb-2">
                  <Input
                    type="number"
                    value={currentDefaultValue || ""}
                    onChange={handleDefaultValueChange}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Enter default value"
                    className="h-7 rounded-lg text-[13px]"
                    aria-label="Default value"
                  />
                </div>
              )}

              <NumberRow
                label="Min value"
                value={inputNode?.minValue}
                onChange={handleUpdateMinValue}
                min={0}
                max={999999}
                defaultHint={0}
              />

              <NumberRow
                label="Max value"
                value={inputNode?.maxValue}
                onChange={handleUpdateMaxValue}
                min={0}
                max={999999}
                defaultHint={100}
              />

              <DropdownMenuItem closeOnClick={false} onClick={handleToggleAllowDecimals}>
                <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
                  Allow decimals
                </span>
                <Switch
                  aria-label="Allow decimals"
                  size="sm"
                  checked={Boolean(inputNode?.allowDecimals)}
                  onCheckedChange={handleToggleAllowDecimals}
                  onClick={handleStopPropagation}
                />
              </DropdownMenuItem>

              <DropdownMenuSeparator />
            </>
          )}

          {fieldType === "formFileUpload" && (
            <>
              <NumberRow
                label="Max file size"
                value={inputNode?.maxFileSize}
                onChange={handleUpdateMaxFileSize}
                min={1}
                max={50}
                suffix="MB"
                defaultHint={10}
              />

              <NumberRow
                label="Max files"
                value={inputNode?.maxFiles}
                onChange={handleUpdateMaxFiles}
                min={0}
                max={20}
                defaultHint={1}
              />

              <DropdownMenuItem closeOnClick={false}>
                <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
                  File types
                </span>
                <Select
                  value={(inputNode?.allowedFileTypes as string) ?? "all"}
                  onValueChange={(v) => v && handleUpdateAllowedFileTypes(v)}
                >
                  <SelectTrigger className="h-[20px] w-[100px] rounded-[4px] border border-transparent bg-transparent px-1 text-[12px] shadow-none focus:border-border/70 focus-visible:border-border/70 focus-visible:ring-0 dark:border-transparent dark:focus:border-border/70 dark:focus-visible:border-border/70">
                    <SelectValue>
                      {(value) =>
                        FILE_TYPE_CATEGORY_LABELS[value as FileTypeCategory] ?? (value as string)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All files</SelectItem>
                    <SelectItem value="images">Images</SelectItem>
                    <SelectItem value="documents">Documents</SelectItem>
                    <SelectItem value="spreadsheets">Spreadsheets</SelectItem>
                  </SelectContent>
                </Select>
              </DropdownMenuItem>

              <FileExtensionToggleRow
                category={
                  isFileTypeCategory(inputNode?.allowedFileTypes)
                    ? inputNode.allowedFileTypes
                    : "all"
                }
                selected={inputNode?.allowedFileExtensions}
                onToggle={handleToggleFileExtension}
              />

              <DropdownMenuSeparator />
            </>
          )}

          {fieldType === "optionCheckbox" && (
            <>
              <NumberRow
                label="Min selections"
                value={inputNode?.minSelections}
                onChange={handleUpdateMinSelections}
                min={0}
                max={50}
                defaultHint={0}
              />
              <NumberRow
                label="Max selections"
                value={inputNode?.maxSelections}
                onChange={handleUpdateMaxSelections}
                min={0}
                max={50}
                defaultHint={3}
              />
              <DropdownMenuItem closeOnClick={false} onClick={handleToggleRandomizeOrder}>
                <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
                  Randomize order
                </span>
                <Switch
                  aria-label="Randomize order"
                  size="sm"
                  checked={Boolean(inputNode?.randomizeOrder)}
                  onCheckedChange={handleToggleRandomizeOrder}
                  onClick={handleStopPropagation}
                />
              </DropdownMenuItem>
              <DropdownMenuItem closeOnClick={false} onClick={handleToggleAllowOther}>
                <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
                  &quot;Other&quot; option
                </span>
                <Switch
                  aria-label="Other option"
                  size="sm"
                  checked={Boolean(inputNode?.allowOther)}
                  onCheckedChange={handleToggleAllowOther}
                  onClick={handleStopPropagation}
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {fieldType === "formMultiSelect" && (
            <>
              <NumberRow
                label="Min selections"
                value={inputNode?.minSelections}
                onChange={handleUpdateMinSelections}
                min={0}
                max={50}
                defaultHint={0}
              />
              <NumberRow
                label="Max selections"
                value={inputNode?.maxSelections}
                onChange={handleUpdateMaxSelections}
                min={0}
                max={50}
                defaultHint={3}
              />
              <DropdownMenuSeparator />
            </>
          )}

          {fieldType === "optionMultiChoice" && (
            <>
              <DropdownMenuItem closeOnClick={false} onClick={handleToggleRandomizeOrder}>
                <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
                  Randomize order
                </span>
                <Switch
                  aria-label="Randomize order"
                  size="sm"
                  checked={Boolean(inputNode?.randomizeOrder)}
                  onCheckedChange={handleToggleRandomizeOrder}
                  onClick={handleStopPropagation}
                />
              </DropdownMenuItem>
              <DropdownMenuItem closeOnClick={false} onClick={handleToggleAllowOther}>
                <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
                  &quot;Other&quot; option
                </span>
                <Switch
                  aria-label="Other option"
                  size="sm"
                  checked={Boolean(inputNode?.allowOther)}
                  onCheckedChange={handleToggleAllowOther}
                  onClick={handleStopPropagation}
                />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Ranking - only Required (handled above) */}
          {fieldType === "optionRanking" && <DropdownMenuSeparator />}

          {/* Date/Time fields only get Required (handled above) + separator */}
          {(fieldType === "formDate" || fieldType === "formTime") && <DropdownMenuSeparator />}

          {fieldType === "formButton" && (
            <>
              <div className="space-y-2 px-2 py-1.5">
                <Label className="text-[12px] text-muted-foreground">Button Name</Label>
                <Input
                  value={buttonText}
                  onChange={handleButtonTextChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Enter button name"
                  className="h-8 rounded-lg text-[13px]"
                />
              </div>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem variant="destructive" onClick={handleDelete}>
            <TrashIcon />
            <span className="flex-1 text-left">Delete</span>
            <DropdownMenuShortcut>Del</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem className="text-foreground/80" onClick={handleDuplicate}>
            <CopyIcon />
            <span className="flex-1 text-left">Duplicate</span>
            <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem className="text-foreground/80" onClick={handleHideMenu}>
            <EyeOffIcon />
            <span className="flex-1 text-left">Hide</span>
            <DropdownMenuShortcut>⌘⌥H</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem className="text-foreground/80" onClick={handleHideMenu}>
            <PlusIcon />
            <span className="flex-1 text-left">Add conditional logic</span>
            <DropdownMenuShortcut>⌘⌥L</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          <DropdownMenuSub open={turnIntoOpen}>
            <DropdownMenuSubTrigger
              className="text-foreground/80"
              onPointerEnter={handleTurnIntoPointerEnter}
              onPointerLeave={handleTurnIntoPointerLeave}
            >
              <span className="text-[13px]">↺</span>
              <span className="flex-1 text-left">Turn into</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              onPointerEnter={handleTurnIntoPointerEnter}
              onPointerLeave={handleTurnIntoPointerLeave}
            >
              <DropdownMenuItem onClick={handleTurnIntoParagraph}>Paragraph</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTurnIntoH1}>Heading 1</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTurnIntoH2}>Heading 2</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTurnIntoH3}>Heading 3</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTurnIntoBlockquote}>Blockquote</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
