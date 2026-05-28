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
import { useReanchorThemeProps } from "@/hooks/use-form-theme";
import {
  FILE_SUBTYPES,
  FILE_TYPE_CATEGORY_LABELS,
  isFileTypeCategory,
} from "@/lib/form-schema/file-upload-types";
import type { FileTypeCategory } from "@/lib/form-schema/file-upload-types";
import { ALLOWED_LABEL_TYPES, FORM_INPUT_NODE_TYPES } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";

type BlockFieldType =
  | "textLike" // formInput, formTextarea, formEmail, formLink
  | "formPhone"
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

const TEXT_LIKE_TYPES = new Set(["formInput", "formTextarea", "formEmail", "formLink"]);

// Block-menu field-type buckets that map to the 8 scalar PlateFormField types
// eligible for the Repeatable toggle. Keep in sync with the scalar variants
// listed in `transform-plate-to-form.ts`.
const REPEATABLE_BLOCK_FIELD_TYPES = new Set<BlockFieldType>([
  "textLike",
  "formPhone",
  "formNumber",
  "formDate",
  "formTime",
]);

const getFieldType = (node: { type?: string; variant?: string } | undefined): BlockFieldType => {
  if (!node?.type) return "unknown";
  const t = node.type;
  if (TEXT_LIKE_TYPES.has(t)) return "textLike";
  if (t === "formPhone") return "formPhone";
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
  const themeReanchor = useReanchorThemeProps("w-[288px] p-1");
  const isOpen = openId === BLOCK_CONTEXT_MENU_ID;

  const position = usePluginOption(BlockMenuPlugin, "position");
  const { x, y } = position ?? { x: 0, y: 0 };

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [fieldName, setFieldName] = React.useState("");
  const [buttonText, setButtonText] = React.useState("");
  const [turnIntoOpen, setTurnIntoOpen] = React.useState(false);
  const blockMenuTriggerRef = React.useRef<HTMLDivElement | null>(null);
  const turnIntoCloseTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { firstNode, firstPath, nodeType, labelNode, inputNode, fieldType, getInputPath } =
    useBlockMenuSelection({ editor, isOpen });

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

  const handlers = useBlockMenuFieldHandlers({
    editor,
    getInputPath,
    inputNode,
    firstPath,
    nodeType,
    setButtonText,
  });
  const {
    handleToggleRequired,
    handleToggleFieldArray,
    handleUpdateMinLength,
    handleUpdateMaxLength,
    handleUpdateMinValue,
    handleUpdateMaxValue,
    handleToggleAllowDecimals,
    handleUpdateMaxFileSize,
    handleUpdateMaxFiles,
    handleUpdateAllowedFileTypes,
    handleToggleFileExtension,
    handleUpdateMinSelections,
    handleUpdateMaxSelections,
    handleToggleRandomizeOrder,
    handleToggleAllowOther,
    handleToggleDefaultValue,
    handleUpdateDefaultValue,
    handleUpdateButtonText,
  } = handlers;

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

  useBlockMenuContextMenuAndHotkeys({
    triggerRef: blockMenuTriggerRef,
    api,
    isOpen,
    isEditingName,
    onDelete: handleDelete,
    onDuplicate: handleDuplicate,
  });

  // Close the menu on scroll. The dropdown's virtual anchor is pinned to the
  // viewport (x, y) where the user clicked; without this the menu floats in
  // place while the underlying block scrolls away. Ignore scroll events that
  // originate inside the menu itself so its own overflow scroll still works.
  React.useEffect(() => {
    if (!isOpen) return;
    const handleScroll = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-radix-popper-content-wrapper], [role='menu']")
      ) {
        return;
      }
      api.blockMenu.hide();
    };
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [isOpen, api.blockMenu]);

  const isRequired = Boolean(inputNode?.required);
  const isFieldArray = Boolean(inputNode?.isFieldArray);
  const canBeFieldArray = REPEATABLE_BLOCK_FIELD_TYPES.has(fieldType);
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
          className={themeReanchor.className}
          style={themeReanchor.style}
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

          {canBeFieldArray && (
            <DropdownMenuItem closeOnClick={false} onClick={handleToggleFieldArray}>
              <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
                Repeatable
              </span>
              <Switch
                aria-label="Repeatable"
                size="sm"
                checked={isFieldArray}
                onCheckedChange={handleToggleFieldArray}
                onClick={handleStopPropagation}
              />
            </DropdownMenuItem>
          )}

          <FieldTypeSettings
            fieldType={fieldType}
            inputNode={inputNode}
            buttonText={buttonText}
            hasDefaultValue={hasDefaultValue}
            currentDefaultValue={currentDefaultValue}
            handlers={{
              handleToggleDefaultValue,
              handleDefaultValueChange,
              handleInputKeyDown,
              handleStopPropagation,
              handleUpdateMinLength,
              handleUpdateMaxLength,
              handleUpdateMinValue,
              handleUpdateMaxValue,
              handleToggleAllowDecimals,
              handleUpdateMaxFileSize,
              handleUpdateMaxFiles,
              handleUpdateAllowedFileTypes,
              handleToggleFileExtension,
              handleUpdateMinSelections,
              handleUpdateMaxSelections,
              handleToggleRandomizeOrder,
              handleToggleAllowOther,
              handleButtonTextChange,
            }}
          />

          <BlockMenuActions
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onHide={handleHideMenu}
            turnIntoOpen={turnIntoOpen}
            onTurnIntoPointerEnter={handleTurnIntoPointerEnter}
            onTurnIntoPointerLeave={handleTurnIntoPointerLeave}
            onTurnIntoParagraph={handleTurnIntoParagraph}
            onTurnIntoH1={handleTurnIntoH1}
            onTurnIntoH2={handleTurnIntoH2}
            onTurnIntoH3={handleTurnIntoH3}
            onTurnIntoBlockquote={handleTurnIntoBlockquote}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

type EditorRef = ReturnType<typeof useEditorPlugin<typeof BlockMenuPlugin>>["editor"];

interface BlockMenuInputNode {
  type?: string;
  required?: boolean;
  isFieldArray?: boolean;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
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

interface UseBlockMenuFieldHandlersOptions {
  editor: EditorRef;
  getInputPath: () => number[] | null;
  inputNode: BlockMenuInputNode | null | undefined;
  firstPath: number[] | undefined;
  nodeType: string | undefined;
  setButtonText: (value: string) => void;
}

const useBlockMenuFieldHandlers = ({
  editor,
  getInputPath,
  inputNode,
  firstPath,
  nodeType,
  setButtonText,
}: UseBlockMenuFieldHandlersOptions) => {
  const handleToggleRequired = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const currentRequired = Boolean(inputNode?.required);
    editor.tf.setNodes({ required: !currentRequired }, { at: inputPath });
  }, [getInputPath, inputNode?.required, editor.tf]);

  const handleToggleFieldArray = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const current = Boolean(inputNode?.isFieldArray);
    if (current) {
      editor.tf.unsetNodes(["isFieldArray"], { at: inputPath });
    } else {
      editor.tf.setNodes({ isFieldArray: true }, { at: inputPath });
    }
  }, [getInputPath, inputNode?.isFieldArray, editor.tf]);

  const updateNumericNode = React.useCallback(
    (key: string, value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || 0;
      if (num === 0) {
        editor.tf.unsetNodes([key], { at: inputPath });
      } else {
        editor.tf.setNodes({ [key]: num }, { at: inputPath });
      }
    },
    [getInputPath, editor.tf],
  );

  const handleUpdateMinLength = React.useCallback(
    (v: string) => updateNumericNode("minLength", v),
    [updateNumericNode],
  );
  const handleUpdateMaxLength = React.useCallback(
    (v: string) => updateNumericNode("maxLength", v),
    [updateNumericNode],
  );
  const handleUpdateMinValue = React.useCallback(
    (v: string) => updateNumericNode("minValue", v),
    [updateNumericNode],
  );
  const handleUpdateMaxValue = React.useCallback(
    (v: string) => updateNumericNode("maxValue", v),
    [updateNumericNode],
  );
  const handleUpdateMaxFiles = React.useCallback(
    (v: string) => updateNumericNode("maxFiles", v),
    [updateNumericNode],
  );
  const handleUpdateMinSelections = React.useCallback(
    (v: string) => updateNumericNode("minSelections", v),
    [updateNumericNode],
  );
  const handleUpdateMaxSelections = React.useCallback(
    (v: string) => updateNumericNode("maxSelections", v),
    [updateNumericNode],
  );

  const handleUpdateMaxFileSize = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || 10;
      editor.tf.setNodes({ maxFileSize: num }, { at: inputPath });
    },
    [getInputPath, editor.tf],
  );

  const toggleBooleanNode = React.useCallback(
    (key: keyof BlockMenuInputNode) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const current = Boolean(inputNode?.[key]);
      if (current) {
        editor.tf.unsetNodes([key as string], { at: inputPath });
      } else {
        editor.tf.setNodes({ [key]: true }, { at: inputPath });
      }
    },
    [getInputPath, inputNode, editor.tf],
  );

  const handleToggleAllowDecimals = React.useCallback(
    () => toggleBooleanNode("allowDecimals"),
    [toggleBooleanNode],
  );
  const handleToggleRandomizeOrder = React.useCallback(
    () => toggleBooleanNode("randomizeOrder"),
    [toggleBooleanNode],
  );
  const handleToggleAllowOther = React.useCallback(
    () => toggleBooleanNode("allowOther"),
    [toggleBooleanNode],
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
      const selected =
        Array.isArray(current) && current.length > 0
          ? current.filter((id): id is string => typeof id === "string" && allSubtypes.includes(id))
          : allSubtypes;
      const next = selected.includes(subtypeId)
        ? selected.filter((id) => id !== subtypeId)
        : [...selected, subtypeId];
      if (next.length === 0) return;
      if (next.length === allSubtypes.length) {
        editor.tf.unsetNodes(["allowedFileExtensions"], { at: inputPath });
        return;
      }
      editor.tf.setNodes({ allowedFileExtensions: next }, { at: inputPath });
    },
    [getInputPath, editor.tf, inputNode?.allowedFileTypes, inputNode?.allowedFileExtensions],
  );

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
    [firstPath, nodeType, editor.tf, setButtonText],
  );

  return {
    handleToggleRequired,
    handleToggleFieldArray,
    handleUpdateMinLength,
    handleUpdateMaxLength,
    handleUpdateMinValue,
    handleUpdateMaxValue,
    handleToggleAllowDecimals,
    handleUpdateMaxFileSize,
    handleUpdateMaxFiles,
    handleUpdateAllowedFileTypes,
    handleToggleFileExtension,
    handleUpdateMinSelections,
    handleUpdateMaxSelections,
    handleToggleRandomizeOrder,
    handleToggleAllowOther,
    handleToggleDefaultValue,
    handleUpdateDefaultValue,
    handleUpdateButtonText,
  };
};

interface FieldTypeSettingsHandlers {
  handleToggleDefaultValue: () => void;
  handleDefaultValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleInputKeyDown: (e: React.KeyboardEvent) => void;
  handleStopPropagation: (e: React.MouseEvent) => void;
  handleUpdateMinLength: (v: string) => void;
  handleUpdateMaxLength: (v: string) => void;
  handleUpdateMinValue: (v: string) => void;
  handleUpdateMaxValue: (v: string) => void;
  handleToggleAllowDecimals: () => void;
  handleUpdateMaxFileSize: (v: string) => void;
  handleUpdateMaxFiles: (v: string) => void;
  handleUpdateAllowedFileTypes: (v: string) => void;
  handleToggleFileExtension: (subtypeId: string) => void;
  handleUpdateMinSelections: (v: string) => void;
  handleUpdateMaxSelections: (v: string) => void;
  handleToggleRandomizeOrder: () => void;
  handleToggleAllowOther: () => void;
  handleButtonTextChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface FieldTypeSettingsProps {
  fieldType: BlockFieldType;
  inputNode: BlockMenuInputNode | null | undefined;
  buttonText: string;
  hasDefaultValue: boolean;
  currentDefaultValue: string | undefined;
  handlers: FieldTypeSettingsHandlers;
}

const FieldTypeSettings = (props: FieldTypeSettingsProps) => {
  const { fieldType } = props;
  if (fieldType === "textLike") return <TextLikeSettings {...props} />;
  if (fieldType === "formPhone") return <FormPhoneSettings {...props} />;
  if (fieldType === "formNumber") return <NumberFieldSettings {...props} />;
  if (fieldType === "formFileUpload") return <FileUploadSettings {...props} />;
  if (fieldType === "optionCheckbox") return <OptionCheckboxSettings {...props} />;
  if (fieldType === "formMultiSelect") return <MultiSelectSettings {...props} />;
  if (fieldType === "optionMultiChoice") return <OptionMultiChoiceSettings {...props} />;
  if (fieldType === "optionRanking" || fieldType === "formDate" || fieldType === "formTime") {
    return <DropdownMenuSeparator />;
  }
  if (fieldType === "formButton") return <ButtonFieldSettings {...props} />;
  return null;
};

const DefaultValueRow = ({
  hasDefaultValue,
  currentDefaultValue,
  numeric,
  handlers,
}: {
  hasDefaultValue: boolean;
  currentDefaultValue: string | undefined;
  numeric?: boolean;
  handlers: FieldTypeSettingsHandlers;
}) => (
  <>
    <DropdownMenuItem closeOnClick={false} onClick={handlers.handleToggleDefaultValue}>
      <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">
        Default answer
      </span>
      <Switch
        aria-label="Default answer"
        size="sm"
        checked={hasDefaultValue}
        onCheckedChange={handlers.handleToggleDefaultValue}
        onClick={handlers.handleStopPropagation}
      />
    </DropdownMenuItem>
    {hasDefaultValue && (
      <div className="px-2 pb-2">
        <Input
          type={numeric ? "number" : undefined}
          value={currentDefaultValue || ""}
          onChange={handlers.handleDefaultValueChange}
          onKeyDown={handlers.handleInputKeyDown}
          placeholder="Enter default value"
          className="h-7 rounded-lg text-[13px]"
          aria-label="Default value"
        />
      </div>
    )}
  </>
);

const SwitchRow = ({
  label,
  ariaLabel,
  checked,
  onToggle,
  onStopPropagation,
}: {
  label: React.ReactNode;
  ariaLabel: string;
  checked: boolean;
  onToggle: () => void;
  onStopPropagation: (e: React.MouseEvent) => void;
}) => (
  <DropdownMenuItem closeOnClick={false} onClick={onToggle}>
    <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">{label}</span>
    <Switch
      aria-label={ariaLabel}
      size="sm"
      checked={checked}
      onCheckedChange={onToggle}
      onClick={onStopPropagation}
    />
  </DropdownMenuItem>
);

const TextLikeSettings = ({
  inputNode,
  hasDefaultValue,
  currentDefaultValue,
  handlers,
}: FieldTypeSettingsProps) => (
  <>
    <DefaultValueRow
      hasDefaultValue={hasDefaultValue}
      currentDefaultValue={currentDefaultValue}
      handlers={handlers}
    />
    <NumberRow
      label="Min characters"
      value={inputNode?.minLength}
      onChange={handlers.handleUpdateMinLength}
      min={0}
      max={1000}
      defaultHint={0}
    />
    {inputNode?.type !== "formTextarea" && (
      <NumberRow
        label="Max characters"
        value={inputNode?.maxLength}
        onChange={handlers.handleUpdateMaxLength}
        min={0}
        max={1000}
        defaultHint={100}
      />
    )}
    <DropdownMenuSeparator />
  </>
);

// Phone numbers are validated by format (E.164 via libphonenumber), not by
// character count — exposing Min/Max characters produced nonsensical errors
// like "Maximum 1 characters allowed" on a valid +91… number.
const FormPhoneSettings = ({
  hasDefaultValue,
  currentDefaultValue,
  handlers,
}: FieldTypeSettingsProps) => (
  <>
    <DefaultValueRow
      hasDefaultValue={hasDefaultValue}
      currentDefaultValue={currentDefaultValue}
      handlers={handlers}
    />
    <DropdownMenuSeparator />
  </>
);

const NumberFieldSettings = ({
  inputNode,
  hasDefaultValue,
  currentDefaultValue,
  handlers,
}: FieldTypeSettingsProps) => (
  <>
    <DefaultValueRow
      hasDefaultValue={hasDefaultValue}
      currentDefaultValue={currentDefaultValue}
      numeric
      handlers={handlers}
    />
    <NumberRow
      label="Min value"
      value={inputNode?.minValue}
      onChange={handlers.handleUpdateMinValue}
      min={0}
      max={999999}
      defaultHint={0}
    />
    <NumberRow
      label="Max value"
      value={inputNode?.maxValue}
      onChange={handlers.handleUpdateMaxValue}
      min={0}
      max={999999}
      defaultHint={100}
    />
    <SwitchRow
      label="Allow decimals"
      ariaLabel="Allow decimals"
      checked={Boolean(inputNode?.allowDecimals)}
      onToggle={handlers.handleToggleAllowDecimals}
      onStopPropagation={handlers.handleStopPropagation}
    />
    <DropdownMenuSeparator />
  </>
);

const FileUploadSettings = ({ inputNode, handlers }: FieldTypeSettingsProps) => (
  <>
    <NumberRow
      label="Max file size"
      value={inputNode?.maxFileSize}
      onChange={handlers.handleUpdateMaxFileSize}
      min={1}
      max={50}
      suffix="MB"
      defaultHint={10}
    />
    <NumberRow
      label="Max files"
      value={inputNode?.maxFiles}
      onChange={handlers.handleUpdateMaxFiles}
      min={0}
      max={20}
      defaultHint={1}
    />
    <DropdownMenuItem closeOnClick={false}>
      <span className="min-w-0 flex-1 text-left text-[13px] text-foreground/80">File types</span>
      <Select
        value={inputNode?.allowedFileTypes ?? "all"}
        onValueChange={(v) => v && handlers.handleUpdateAllowedFileTypes(v)}
      >
        <SelectTrigger className="h-[20px] w-[100px] rounded-[4px] border border-transparent bg-transparent px-1 text-[12px] shadow-none focus:border-border/70 focus-visible:border-border/70 focus-visible:ring-0 dark:border-transparent dark:focus:border-border/70 dark:focus-visible:border-border/70">
          <SelectValue>
            {(value) => FILE_TYPE_CATEGORY_LABELS[value as FileTypeCategory] ?? (value as string)}
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
        isFileTypeCategory(inputNode?.allowedFileTypes) ? inputNode.allowedFileTypes : "all"
      }
      selected={inputNode?.allowedFileExtensions}
      onToggle={handlers.handleToggleFileExtension}
    />
    <DropdownMenuSeparator />
  </>
);

const OptionCheckboxSettings = ({ inputNode, handlers }: FieldTypeSettingsProps) => (
  <>
    <NumberRow
      label="Min selections"
      value={inputNode?.minSelections}
      onChange={handlers.handleUpdateMinSelections}
      min={0}
      max={50}
      defaultHint={0}
    />
    <NumberRow
      label="Max selections"
      value={inputNode?.maxSelections}
      onChange={handlers.handleUpdateMaxSelections}
      min={0}
      max={50}
      defaultHint={3}
    />
    <SwitchRow
      label="Randomize order"
      ariaLabel="Randomize order"
      checked={Boolean(inputNode?.randomizeOrder)}
      onToggle={handlers.handleToggleRandomizeOrder}
      onStopPropagation={handlers.handleStopPropagation}
    />
    <SwitchRow
      label={<>&quot;Other&quot; option</>}
      ariaLabel="Other option"
      checked={Boolean(inputNode?.allowOther)}
      onToggle={handlers.handleToggleAllowOther}
      onStopPropagation={handlers.handleStopPropagation}
    />
    <DropdownMenuSeparator />
  </>
);

const MultiSelectSettings = ({ inputNode, handlers }: FieldTypeSettingsProps) => (
  <>
    <NumberRow
      label="Min selections"
      value={inputNode?.minSelections}
      onChange={handlers.handleUpdateMinSelections}
      min={0}
      max={50}
      defaultHint={0}
    />
    <NumberRow
      label="Max selections"
      value={inputNode?.maxSelections}
      onChange={handlers.handleUpdateMaxSelections}
      min={0}
      max={50}
      defaultHint={3}
    />
    <DropdownMenuSeparator />
  </>
);

const OptionMultiChoiceSettings = ({ inputNode, handlers }: FieldTypeSettingsProps) => (
  <>
    <SwitchRow
      label="Randomize order"
      ariaLabel="Randomize order"
      checked={Boolean(inputNode?.randomizeOrder)}
      onToggle={handlers.handleToggleRandomizeOrder}
      onStopPropagation={handlers.handleStopPropagation}
    />
    <SwitchRow
      label={<>&quot;Other&quot; option</>}
      ariaLabel="Other option"
      checked={Boolean(inputNode?.allowOther)}
      onToggle={handlers.handleToggleAllowOther}
      onStopPropagation={handlers.handleStopPropagation}
    />
    <DropdownMenuSeparator />
  </>
);

const ButtonFieldSettings = ({ buttonText, handlers }: FieldTypeSettingsProps) => (
  <>
    <div className="space-y-2 px-2 py-1.5">
      <Label className="text-[12px] text-muted-foreground">Button Name</Label>
      <Input
        value={buttonText}
        onChange={handlers.handleButtonTextChange}
        onKeyDown={handlers.handleInputKeyDown}
        placeholder="Enter button name"
        className="h-8 rounded-lg text-[13px]"
      />
    </div>
    <DropdownMenuSeparator />
  </>
);

interface BlockMenuActionsProps {
  onDelete: () => void;
  onDuplicate: () => void;
  onHide: () => void;
  turnIntoOpen: boolean;
  onTurnIntoPointerEnter: () => void;
  onTurnIntoPointerLeave: () => void;
  onTurnIntoParagraph: () => void;
  onTurnIntoH1: () => void;
  onTurnIntoH2: () => void;
  onTurnIntoH3: () => void;
  onTurnIntoBlockquote: () => void;
}

const BlockMenuActions = ({
  onDelete,
  onDuplicate,
  onHide,
  turnIntoOpen,
  onTurnIntoPointerEnter,
  onTurnIntoPointerLeave,
  onTurnIntoParagraph,
  onTurnIntoH1,
  onTurnIntoH2,
  onTurnIntoH3,
  onTurnIntoBlockquote,
}: BlockMenuActionsProps) => (
  <>
    <DropdownMenuItem variant="destructive" onClick={onDelete}>
      <TrashIcon />
      <span className="flex-1 text-left">Delete</span>
      <DropdownMenuShortcut>Del</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuItem className="text-foreground/80" onClick={onDuplicate}>
      <CopyIcon />
      <span className="flex-1 text-left">Duplicate</span>
      <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuItem className="text-foreground/80" onClick={onHide}>
      <EyeOffIcon />
      <span className="flex-1 text-left">Hide</span>
      <DropdownMenuShortcut>⌘⌥H</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuItem className="text-foreground/80" onClick={onHide}>
      <PlusIcon />
      <span className="flex-1 text-left">Add conditional logic</span>
      <DropdownMenuShortcut>⌘⌥L</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuSeparator />

    <DropdownMenuSub open={turnIntoOpen}>
      <DropdownMenuSubTrigger
        className="text-foreground/80"
        onPointerEnter={onTurnIntoPointerEnter}
        onPointerLeave={onTurnIntoPointerLeave}
      >
        <span className="text-[13px]">↺</span>
        <span className="flex-1 text-left">Turn into</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        onPointerEnter={onTurnIntoPointerEnter}
        onPointerLeave={onTurnIntoPointerLeave}
      >
        <DropdownMenuItem onClick={onTurnIntoParagraph}>Paragraph</DropdownMenuItem>
        <DropdownMenuItem onClick={onTurnIntoH1}>Heading 1</DropdownMenuItem>
        <DropdownMenuItem onClick={onTurnIntoH2}>Heading 2</DropdownMenuItem>
        <DropdownMenuItem onClick={onTurnIntoH3}>Heading 3</DropdownMenuItem>
        <DropdownMenuItem onClick={onTurnIntoBlockquote}>Blockquote</DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  </>
);

interface UseBlockMenuContextMenuAndHotkeysOptions {
  triggerRef: React.RefObject<HTMLDivElement | null>;
  api: ReturnType<typeof useEditorPlugin<typeof BlockMenuPlugin>>["api"];
  isOpen: boolean;
  isEditingName: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
}

const useBlockMenuContextMenuAndHotkeys = ({
  triggerRef,
  api,
  isOpen,
  isEditingName,
  onDelete,
  onDuplicate,
}: UseBlockMenuContextMenuAndHotkeysOptions) => {
  React.useEffect(() => {
    const node = triggerRef.current;
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
  }, [api.blockMenu, triggerRef]);

  useHotkeys(
    "delete, backspace",
    onDelete,
    { enabled: isOpen && !isEditingName, preventDefault: true },
    [isOpen, isEditingName, onDelete],
  );

  useHotkeys("mod+d", onDuplicate, { enabled: isOpen && !isEditingName, preventDefault: true }, [
    isOpen,
    isEditingName,
    onDuplicate,
  ]);

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
};

interface BlockMenuFirstNode {
  type?: string;
  variant?: string;
  required?: boolean;
  isFieldArray?: boolean;
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

const useBlockMenuSelection = ({ editor, isOpen }: { editor: EditorRef; isOpen: boolean }) => {
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

  const firstNode = selectedNodes[0]?.[0] as BlockMenuFirstNode | undefined;
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
          return prev[0] as BlockMenuFirstNode;
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
          return next[0] as BlockMenuFirstNode;
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

  return { firstNode, firstPath, nodeType, labelNode, inputNode, fieldType, getInputPath };
};
