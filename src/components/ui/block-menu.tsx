import {
  BulkInsertIcon,
  CharacterLimitIcon,
  CheckIcon,
  ChevronLeftIcon,
  ClockLineIcon,
  ChevronSelectIcon,
  ConditionalLogicIcon,
  DecimalsArrowRightIcon,
  DeleteIcon,
  DuplicateIcon,
  FileIcon,
  HashIcon,
  HideIcon,
  IconPhone,
  LabelsIcon,
  PhotoIcon,
  RepeatIcon,
  RequiredFieldIcon,
  SearchLineIcon,
  SelectionLimitIcon,
  ShuffleOptionsIcon,
  TurnIntoIcon,
  VerifiedIcon,
} from "@/components/ui/icons";
import {
  BLOCK_CONTEXT_MENU_ID,
  BlockMenuPlugin,
  BlockSelectionPlugin,
} from "@platejs/selection/react";
import type { TElement } from "platejs";
import { KEYS, PathApi } from "platejs";
import { useEditorPlugin, useEditorSelector, useHotkeys, usePluginOption } from "platejs/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { OptionLabelStyle } from "@/components/ui/form-option-item-constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLogicBlockNode } from "@/components/ui/logic-block-node";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { registerBlockMenuClose, unregisterBlockMenuClose } from "@/lib/editor/block-menu-close";
import { useReanchorThemeProps } from "@/hooks/use-form-theme";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { ALL_FILE_EXTENSIONS, FILE_CATEGORIES } from "@/lib/form-schema/file-upload-types";
import { ALLOWED_LABEL_TYPES, FORM_INPUT_NODE_TYPES } from "@/lib/form-schema/form-field-constants";
import type {
  DecimalSeparator,
  NumberFormatConfig,
  NumberFormatType,
  ThousandsSeparator,
} from "@/lib/form-schema/number-format";
import { PHONE_COUNTRIES } from "@/lib/phone/countries";

type BlockFieldType =
  | "textLike" // formInput, formTextarea, formLink
  | "formEmail"
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

const TEXT_LIKE_TYPES = new Set(["formInput", "formTextarea", "formLink"]);

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
  if (t === "formEmail") return "formEmail";
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

const stopMouseEventPropagation = (e: React.MouseEvent) => {
  e.stopPropagation();
};

const stopKeyEventPropagation = (e: React.KeyboardEvent) => {
  e.stopPropagation();
};

export const BlockMenu = ({ children }: { children: React.ReactNode }) => {
  const { api, editor } = useEditorPlugin(BlockMenuPlugin);
  const openId = usePluginOption(BlockMenuPlugin, "openId");
  const themeReanchor = useReanchorThemeProps("w-[246px] p-1");
  const isOpen = openId === BLOCK_CONTEXT_MENU_ID;

  // Entering preview keeps the editor mounted (Activity) but the menu is portaled to body, so it
  // would linger over the preview. <Activity> tears down effects on hide (racing a reactive close),
  // so instead register the close fn; the preview toggle calls it synchronously before hiding.
  useMountEffect(() => {
    const close = () => api.blockMenu.hide();
    registerBlockMenuClose(close);
    return () => unregisterBlockMenuClose(close);
  });

  const position = usePluginOption(BlockMenuPlugin, "position");
  const { x, y } = position ?? { x: 0, y: 0 };

  const [buttonText, setButtonText] = React.useState("");
  const blockMenuTriggerRef = React.useRef<HTMLDivElement | null>(null);

  const { firstNode, firstPath, nodeType, inputNode, fieldType, getInputPath } =
    useBlockMenuSelection({ editor, isOpen });

  const [wasOpen, setWasOpen] = React.useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
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

  const handleDelete = React.useCallback(() => {
    editor.getTransforms(BlockSelectionPlugin).blockSelection.removeNodes();
    editor.tf.focus();
    api.blockMenu.hide();
  }, [editor, api.blockMenu]);

  const handleDuplicate = React.useCallback(() => {
    editor.getTransforms(BlockSelectionPlugin).blockSelection.duplicate();
    api.blockMenu.hide();
  }, [editor, api.blockMenu]);

  const handleAddLogic = React.useCallback(() => {
    if (!firstPath) return;
    // Insert the logic block as the next sibling of the selected block.
    editor.tf.insertNodes(createLogicBlockNode() as unknown as TElement, {
      at: PathApi.next(firstPath),
      select: false,
    });
    api.blockMenu.hide();
  }, [editor, firstPath, api.blockMenu]);

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

  const handleHide = React.useCallback(() => {
    api.blockMenu.hide();
  }, [api.blockMenu]);

  // Bulk insert: capture the option group's tail + variant when the dialog opens (the menu
  // closes, which clears the selection), then splice the parsed lines in on Save.
  const [bulkInsert, setBulkInsert] = React.useState<{ at: number; variant: string } | null>(null);

  const handleOpenBulkInsert = React.useCallback(() => {
    const optionPath = getInputPath();
    if (!optionPath) return;
    const start = optionPath[0];
    const nodes = editor.children as TElement[];
    // Anchor must resolve to an option (selection may be the option or its label above it).
    const startNode = nodes[start] as { type?: string; variant?: string } | undefined;
    if (startNode?.type !== "formOptionItem") return;
    let lastIndex = start;
    for (let i = start + 1; i < nodes.length; i++) {
      if (nodes[i]?.type === "formOptionItem") lastIndex = i;
      else break;
    }
    const variant = startNode.variant || "checkbox";
    const at = lastIndex + 1;
    api.blockMenu.hide();
    // Defer past the click that closed the menu — opening the modal synchronously lets that
    // same pointer event dismiss it, so the dialog would flash and never appear.
    setTimeout(() => setBulkInsert({ at, variant }), 0);
  }, [getInputPath, editor, api.blockMenu]);

  const handleBulkInsertSubmit = React.useCallback(
    (text: string) => {
      const target = bulkInsert;
      setBulkInsert(null);
      if (!target) return;
      const labels = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (labels.length === 0) return;
      const newNodes = labels.map(
        (label) =>
          ({
            type: "formOptionItem",
            variant: target.variant,
            children: [{ text: label }],
          }) as unknown as TElement,
      );
      editor.tf.insertNodes(newNodes, { at: [target.at] });
      // Focus back to the last inserted option, cursor at its end.
      const lastPath = [target.at + labels.length - 1];
      editor.tf.focus();
      const end = editor.api.end(lastPath);
      if (end) editor.tf.select(end);
    },
    [bulkInsert, editor],
  );

  useBlockMenuContextMenuAndHotkeys({
    triggerRef: blockMenuTriggerRef,
    api,
    isOpen,
    onDelete: handleDelete,
    onDuplicate: handleDuplicate,
    onAddLogic: handleAddLogic,
    onBulkInsert: handleOpenBulkInsert,
  });

  // Close on scroll — virtual anchor is pinned to the click (x,y), so the menu would float in
  // place as the block scrolls away. Ignore scrolls from inside the menu so its overflow works.
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

  const handleOpenChange = React.useCallback(
    (open: boolean, eventDetails: { reason?: string }) => {
      if (!open) {
        const { reason } = eventDetails;
        // Close on deliberate dismissals only, not focus events from submenu interactions.
        if (reason === "outsidePress" || reason === "escapeKey" || reason === "itemPress") {
          api.blockMenu.hide();
        }
      }
    },
    [api.blockMenu],
  );

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

  // Dependency-injected context: pieces read state + actions, never prop-drilled handlers.
  const contextValue = React.useMemo<BlockMenuContextValue>(
    () => ({
      state: { fieldType, inputNode, buttonText },
      actions: {
        toggleRequired: handlers.handleToggleRequired,
        toggleUse24Hour: handlers.handleToggleUse24Hour,
        toggleRepeatable: handlers.handleToggleFieldArray,
        updateMinLength: handlers.handleUpdateMinLength,
        updateMaxLength: handlers.handleUpdateMaxLength,
        updateMinValue: handlers.handleUpdateMinValue,
        updateMaxValue: handlers.handleUpdateMaxValue,
        toggleAllowDecimals: handlers.handleToggleAllowDecimals,
        updateMaxFileSize: handlers.handleUpdateMaxFileSize,
        updateMaxFiles: handlers.handleUpdateMaxFiles,
        setAllowedExtensions: handlers.handleSetAllowedExtensions,
        updateMinSelections: handlers.handleUpdateMinSelections,
        updateMaxSelections: handlers.handleUpdateMaxSelections,
        toggleRandomizeOrder: handlers.handleToggleRandomizeOrder,
        toggleAllowOther: handlers.handleToggleAllowOther,
        toggleVerifyEmail: handlers.handleToggleVerifyEmail,
        setDefaultCountryCode: handlers.handleSetDefaultCountryCode,
        setOptionLabel: handlers.handleSetOptionLabel,
        toggleOptionImage: handlers.handleToggleOptionImage,
        setNumberFormat: handlers.handleSetNumberFormat,
        updateButtonText: handlers.handleUpdateButtonText,
        deleteBlock: handleDelete,
        duplicateBlock: handleDuplicate,
        addLogic: handleAddLogic,
        hide: handleHide,
        turnInto: handleTurnInto,
        openBulkInsert: handleOpenBulkInsert,
      },
    }),
    [
      fieldType,
      inputNode,
      buttonText,
      handlers,
      handleDelete,
      handleDuplicate,
      handleAddLogic,
      handleHide,
      handleTurnInto,
      handleOpenBulkInsert,
    ],
  );

  const FieldMenu = FIELD_MENU_VARIANTS[fieldType];

  return (
    <>
      <div ref={blockMenuTriggerRef}>{children}</div>

      {/* Conditionally MOUNTED (not just `open`): closing unmounts the portal immediately instead of
          playing an exit animation. Entering preview hides the editor via <Activity>, which would
          freeze a still-animating portal mid-close and leave it stuck over the preview. */}
      {isOpen && (
        <DropdownMenu open onOpenChange={handleOpenChange} modal={false}>
          <DropdownMenuContent
            anchor={virtualAnchor}
            className={themeReanchor.className}
            style={themeReanchor.style}
            align="end"
            sideOffset={8}
          >
            <BlockMenuContext value={contextValue}>
              <FieldMenu />
            </BlockMenuContext>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <BulkInsertDialog
        open={bulkInsert !== null}
        onClose={() => setBulkInsert(null)}
        onSubmit={handleBulkInsertSubmit}
      />
    </>
  );
};

type EditorRef = ReturnType<typeof useEditorPlugin<typeof BlockMenuPlugin>>["editor"];

interface BlockMenuInputNode {
  type?: string;
  variant?: string;
  optionLabel?: OptionLabelStyle;
  showImage?: boolean;
  use24Hour?: boolean;
  numberFormat?: NumberFormatType;
  decimalSeparator?: DecimalSeparator;
  thousandsSeparator?: ThousandsSeparator;
  verifyEmail?: boolean;
  defaultCountryCode?: string;
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

  // Time field: toggle 24-hour (railway) entry. Unset to fall back to 12-hour AM/PM.
  const handleToggleUse24Hour = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    if (inputNode?.use24Hour) editor.tf.unsetNodes(["use24Hour"], { at: inputPath });
    else editor.tf.setNodes({ use24Hour: true } as Partial<TElement>, { at: inputPath });
  }, [getInputPath, inputNode?.use24Hour, editor.tf]);

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

  // Decimals are allowed by default — only an explicit `false` enforces integer-only (see
  // generate-preview-schema). Can't use toggleBooleanNode: it flips true↔unset, both of which
  // allow decimals. Turning the toggle off persists `false`; turning it back on unsets it.
  const handleToggleAllowDecimals = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const allowed = inputNode?.allowDecimals !== false;
    if (allowed) {
      editor.tf.setNodes({ allowDecimals: false }, { at: inputPath });
    } else {
      editor.tf.unsetNodes(["allowDecimals"], { at: inputPath });
    }
  }, [getInputPath, inputNode, editor.tf]);
  const handleToggleRandomizeOrder = React.useCallback(
    () => toggleBooleanNode("randomizeOrder"),
    [toggleBooleanNode],
  );
  const handleToggleAllowOther = React.useCallback(
    () => toggleBooleanNode("allowOther"),
    [toggleBooleanNode],
  );
  const handleToggleVerifyEmail = React.useCallback(
    () => toggleBooleanNode("verifyEmail"),
    [toggleBooleanNode],
  );

  // Default country code — store the ISO code, or unset to fall back to the browser locale.
  const handleSetDefaultCountryCode = React.useCallback(
    (code: string | undefined) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      if (code) {
        editor.tf.setNodes({ defaultCountryCode: code }, { at: inputPath });
      } else {
        editor.tf.unsetNodes(["defaultCountryCode"], { at: inputPath });
      }
    },
    [getInputPath, editor.tf],
  );

  // Labels apply to the whole option group — set optionLabel on every contiguous sibling option.
  const handleSetOptionLabel = React.useCallback(
    (style: OptionLabelStyle) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const start = inputPath[0];
      const nodes = editor.children as TElement[];
      if (nodes[start]?.type !== "formOptionItem") return;
      let first = start;
      let last = start;
      while (first > 0 && nodes[first - 1]?.type === "formOptionItem") first--;
      while (last < nodes.length - 1 && nodes[last + 1]?.type === "formOptionItem") last++;
      editor.tf.withoutNormalizing(() => {
        for (let i = first; i <= last; i++) {
          editor.tf.setNodes({ optionLabel: style }, { at: [i] });
        }
      });
    },
    [getInputPath, editor],
  );

  // "Image" applies to the whole option group — toggle showImage on every contiguous sibling option.
  const handleToggleOptionImage = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    const start = inputPath[0];
    const nodes = editor.children as TElement[];
    if (nodes[start]?.type !== "formOptionItem") return;
    let first = start;
    let last = start;
    while (first > 0 && nodes[first - 1]?.type === "formOptionItem") first--;
    while (last < nodes.length - 1 && nodes[last + 1]?.type === "formOptionItem") last++;
    const enabled = (nodes[start] as { showImage?: boolean }).showImage === true;
    editor.tf.withoutNormalizing(() => {
      for (let i = first; i <= last; i++) {
        if (enabled) editor.tf.unsetNodes(["showImage"], { at: [i] });
        else editor.tf.setNodes({ showImage: true } as Partial<TElement>, { at: [i] });
      }
    });
  }, [getInputPath, editor]);

  // Number "Format" — patch one config field at a time; "off"/"none" unset to keep the node clean.
  const handleSetNumberFormat = React.useCallback(
    (patch: Partial<NumberFormatConfig>) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const sets: Record<string, unknown> = {};
      const unsets: string[] = [];
      if (patch.format !== undefined) {
        if (patch.format === "off") unsets.push("numberFormat");
        else sets.numberFormat = patch.format;
      }
      if (patch.decimalSeparator !== undefined) sets.decimalSeparator = patch.decimalSeparator;
      if (patch.thousandsSeparator !== undefined) {
        if (patch.thousandsSeparator === "none") unsets.push("thousandsSeparator");
        else sets.thousandsSeparator = patch.thousandsSeparator;
      }
      editor.tf.withoutNormalizing(() => {
        if (Object.keys(sets).length > 0) editor.tf.setNodes(sets, { at: inputPath });
        if (unsets.length > 0) editor.tf.unsetNodes(unsets, { at: inputPath });
      });
    },
    [getInputPath, editor],
  );

  // Allowed files — store the flat extension allow-list. Empty or the full catalog ⇒ unset, which
  // the runtime treats as "all files allowed". Also clears any legacy allowedFileTypes category.
  const handleSetAllowedExtensions = React.useCallback(
    (next: string[]) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const deduped = [...new Set(next)];
      if (deduped.length === 0 || deduped.length >= ALL_FILE_EXTENSIONS.length) {
        editor.tf.unsetNodes(["allowedFileExtensions", "allowedFileTypes"], { at: inputPath });
        return;
      }
      editor.tf.withoutNormalizing(() => {
        editor.tf.setNodes({ allowedFileExtensions: deduped }, { at: inputPath });
        editor.tf.unsetNodes(["allowedFileTypes"], { at: inputPath });
      });
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

  // Memoized so the assembled context value stays referentially stable across renders.
  return React.useMemo(
    () => ({
      handleToggleRequired,
      handleToggleUse24Hour,
      handleToggleFieldArray,
      handleUpdateMinLength,
      handleUpdateMaxLength,
      handleUpdateMinValue,
      handleUpdateMaxValue,
      handleToggleAllowDecimals,
      handleUpdateMaxFileSize,
      handleUpdateMaxFiles,
      handleSetAllowedExtensions,
      handleUpdateMinSelections,
      handleUpdateMaxSelections,
      handleToggleRandomizeOrder,
      handleToggleAllowOther,
      handleToggleVerifyEmail,
      handleSetDefaultCountryCode,
      handleSetOptionLabel,
      handleToggleOptionImage,
      handleSetNumberFormat,
      handleUpdateButtonText,
    }),
    [
      handleToggleRequired,
      handleToggleUse24Hour,
      handleToggleFieldArray,
      handleUpdateMinLength,
      handleUpdateMaxLength,
      handleUpdateMinValue,
      handleUpdateMaxValue,
      handleToggleAllowDecimals,
      handleUpdateMaxFileSize,
      handleUpdateMaxFiles,
      handleSetAllowedExtensions,
      handleUpdateMinSelections,
      handleUpdateMaxSelections,
      handleToggleRandomizeOrder,
      handleToggleAllowOther,
      handleToggleVerifyEmail,
      handleSetDefaultCountryCode,
      handleSetOptionLabel,
      handleToggleOptionImage,
      handleSetNumberFormat,
      handleUpdateButtonText,
    ],
  );
};

/**
 * Block-menu composition context. The provider (in `BlockMenu`) injects field state and the
 * action callbacks; each compound piece below reads what it needs via `useBlockMenu()` instead
 * of having a giant handlers object prop-drilled through it. Adding a new field type means
 * writing a new variant in `FIELD_MENU_VARIANTS` that composes the existing pieces.
 */
interface BlockMenuActions {
  toggleRequired: () => void;
  toggleUse24Hour: () => void;
  toggleRepeatable: () => void;
  updateMinLength: (v: string) => void;
  updateMaxLength: (v: string) => void;
  updateMinValue: (v: string) => void;
  updateMaxValue: (v: string) => void;
  toggleAllowDecimals: () => void;
  updateMaxFileSize: (v: string) => void;
  updateMaxFiles: (v: string) => void;
  setAllowedExtensions: (next: string[]) => void;
  updateMinSelections: (v: string) => void;
  updateMaxSelections: (v: string) => void;
  toggleRandomizeOrder: () => void;
  toggleAllowOther: () => void;
  toggleVerifyEmail: () => void;
  setDefaultCountryCode: (code: string | undefined) => void;
  setOptionLabel: (style: OptionLabelStyle) => void;
  toggleOptionImage: () => void;
  setNumberFormat: (patch: Partial<NumberFormatConfig>) => void;
  updateButtonText: (v: string) => void;
  deleteBlock: () => void;
  duplicateBlock: () => void;
  addLogic: () => void;
  hide: () => void;
  turnInto: (type: string) => void;
  openBulkInsert: () => void;
}

interface BlockMenuContextValue {
  state: {
    fieldType: BlockFieldType;
    inputNode: BlockMenuInputNode | null | undefined;
    buttonText: string;
  };
  actions: BlockMenuActions;
}

const BlockMenuContext = React.createContext<BlockMenuContextValue | null>(null);

const useBlockMenu = (): BlockMenuContextValue => {
  const ctx = React.use(BlockMenuContext);
  if (!ctx) throw new Error("BlockMenu pieces must be rendered inside <BlockMenu>");
  return ctx;
};

// Hover open/close with a close grace period — Base UI's auto trigger↔content bridging is
// unreliable inside this non-modal virtual-anchored popup, so submenus drive open state by hand.
const useHoverSubmenu = () => {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onPointerEnter = React.useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const onPointerLeave = React.useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }, []);
  React.useEffect(() => () => clearTimeout(closeTimer.current), []);
  return { open, setOpen, onPointerEnter, onPointerLeave };
};

// Groups a field's numeric settings behind a submenu trigger (Figma "Character limit" pattern).
// Hover-controlled like the Turn-into submenu — Base UI's auto trigger↔content bridging is
// unreliable inside this non-modal virtual-anchored popup, and these submenus hold inputs.
const SettingsSubmenu = ({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) => {
  const { open, setOpen, onPointerEnter: onEnter, onPointerLeave: onLeave } = useHoverSubmenu();

  return (
    <DropdownMenuSub open={open}>
      <DropdownMenuSubTrigger
        className="text-sm text-foreground/80"
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="flex w-[216px] flex-col gap-3 p-2"
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex items-center gap-0.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeftIcon className="-ms-0.5 size-4" />
          <span>{label}</span>
        </button>
        <div className="flex flex-col gap-2">{children}</div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

type StepperRowProps = {
  /** Visible label (e.g. "Min") — the submenu header carries the rest of the context. */
  label: string;
  ariaLabel: string;
  value: number | undefined;
  onChange: (raw: string) => void;
  min?: number;
  max?: number;
  /** Placeholder when unset — hints the effective default without persisting it. */
  defaultHint?: number;
};

// Submenu row matching Figma's limit panel: label left, value in a filled box with an
// up/down stepper. Plain divs (not menu items) so there's no row-hover treatment.
const StepperRow = ({
  label,
  ariaLabel,
  value,
  onChange,
  min,
  max,
  defaultHint,
}: StepperRowProps) => {
  const step = (delta: number) => {
    let next = (value ?? defaultHint ?? 0) + delta;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(String(next));
  };

  return (
    <div className="flex items-center gap-2.5">
      <span className="min-w-0 flex-1 text-[14px] font-medium text-foreground">{label}</span>
      <div className="flex w-[140px] items-center gap-2 rounded-lg bg-(--color-gray-alpha-100) px-2 py-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={value ?? ""}
          placeholder={defaultHint !== undefined ? String(defaultHint) : undefined}
          onChange={(e) => onChange(e.target.value || "0")}
          onKeyDown={stopKeyEventPropagation}
          onClick={stopMouseEventPropagation}
          onPointerDown={stopMouseEventPropagation}
          aria-label={ariaLabel}
          className="min-w-0 flex-1 [appearance:textfield] bg-transparent text-[14px] font-medium text-foreground tabular-nums outline-none placeholder:text-muted-foreground/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {/* Single Figma stepper glyph; transparent top/bottom halves drive ±1. */}
        <div className="relative flex h-4 w-3 shrink-0 flex-col text-muted-foreground">
          <ChevronSelectIcon className="pointer-events-none absolute inset-0 m-auto size-3" />
          <button
            type="button"
            aria-label={`Increase ${ariaLabel}`}
            onClick={() => step(1)}
            onPointerDown={stopMouseEventPropagation}
            className="flex-1"
          />
          <button
            type="button"
            aria-label={`Decrease ${ariaLabel}`}
            onClick={() => step(-1)}
            onPointerDown={stopMouseEventPropagation}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
};

// The menu renders inside `.bf-themed`, which remaps `--input` (the Switch's default off track)
// to the form's tinted input color. Pin the off track to the design-system gray-300 to match Figma.
const SWITCH_OFF_TRACK = "data-unchecked:bg-(--color-gray-300)";

const SwitchRow = ({
  label,
  ariaLabel,
  checked,
  onToggle,
  icon,
}: {
  label: React.ReactNode;
  ariaLabel: string;
  checked: boolean;
  onToggle: () => void;
  /** Leading icon; when omitted the row insets so its label aligns with iconed rows. */
  icon?: React.ReactNode;
}) => (
  // Pass `inset` only when there's no icon. `inset={false}` would still render
  // data-inset="false", and the `data-inset:ps-7` variant ([data-inset]) matches any value —
  // wrongly indenting iconed rows by 28px. Omitting it (undefined) drops the attribute.
  <DropdownMenuItem closeOnClick={false} onClick={onToggle} inset={icon ? undefined : true}>
    {icon}
    <span className="min-w-0 flex-1 text-left text-foreground/80">{label}</span>
    <Switch
      aria-label={ariaLabel}
      size="sm"
      className={SWITCH_OFF_TRACK}
      checked={checked}
      onCheckedChange={onToggle}
      onClick={stopMouseEventPropagation}
    />
  </DropdownMenuItem>
);

/* ── Compound pieces — each reads only what it needs from `useBlockMenu()` ── */

const RequiredToggle = () => {
  const { state, actions } = useBlockMenu();
  return (
    <SwitchRow
      icon={<RequiredFieldIcon className="text-foreground/80" />}
      label="Required"
      ariaLabel="Required"
      checked={Boolean(state.inputNode?.required)}
      onToggle={actions.toggleRequired}
    />
  );
};

const VerifyEmail = () => {
  const { state, actions } = useBlockMenu();
  return (
    <SwitchRow
      icon={<VerifiedIcon className="text-foreground/80" />}
      label="Verify email"
      ariaLabel="Verify email"
      checked={Boolean(state.inputNode?.verifyEmail)}
      onToggle={actions.toggleVerifyEmail}
    />
  );
};

// Default country code (Figma node 25633-9894): searchable country list with an "Off" option;
// the chosen ISO code seeds the live phone input's country. Search header stays pinned while the
// list scrolls.
const DefaultCountryCode = () => {
  const { open, onPointerEnter, onPointerLeave } = useHoverSubmenu();
  const { state, actions } = useBlockMenu();
  const [search, setSearch] = React.useState("");
  const current = state.inputNode?.defaultCountryCode;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q),
    );
  }, [search]);

  return (
    <DropdownMenuSub open={open}>
      <DropdownMenuSubTrigger
        className="text-sm text-foreground/80"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <IconPhone className="text-foreground/80" />
        <span className="flex-1 text-left">Default country code</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="w-[246px]"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <div className="flex h-7 items-center gap-1.5 rounded-lg bg-secondary px-2 focus-within:ring-2 focus-within:ring-ring/50">
          <SearchLineIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={stopKeyEventPropagation}
            onPointerDown={stopMouseEventPropagation}
            placeholder="Search"
            aria-label="Search countries"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        {/* Unset ⇒ the live phone input auto-detects from the browser locale (already wired in
            phone-input.tsx). This is the default state, so it sits first and is checked when no
            explicit country is chosen. */}
        <DropdownMenuItem
          closeOnClick={false}
          className="mt-1 text-foreground/80"
          onClick={() => actions.setDefaultCountryCode(undefined)}
        >
          <span className="min-w-0 flex-1 text-left">Auto-detect</span>
          {!current && <CheckIcon className="size-4 shrink-0 text-foreground/80" />}
        </DropdownMenuItem>
        <div className="mt-0.5 max-h-[260px] overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No country found.</div>
          ) : (
            filtered.map((c) => (
              <DropdownMenuItem
                key={c.code}
                closeOnClick={false}
                className="text-foreground/80"
                onClick={() => actions.setDefaultCountryCode(c.code)}
              >
                <span aria-hidden className="shrink-0 text-base leading-none">
                  {c.flag}
                </span>
                <span className="min-w-0 flex-1 truncate text-left">
                  {c.name} (+{c.dialCode})
                </span>
                {current === c.code && <CheckIcon className="size-4 shrink-0 text-foreground/80" />}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

const RepeatableToggle = () => {
  const { state, actions } = useBlockMenu();
  // Only the scalar field types map to a repeatable PlateFormField (see transform-plate-to-form.ts).
  if (!REPEATABLE_BLOCK_FIELD_TYPES.has(state.fieldType)) return null;
  return (
    <SwitchRow
      icon={<RepeatIcon className="size-4 text-foreground/80" />}
      label="Repeatable"
      ariaLabel="Repeatable"
      checked={Boolean(state.inputNode?.isFieldArray)}
      onToggle={actions.toggleRepeatable}
    />
  );
};

// formTextarea is free-form prose — it takes a Min but no Max character cap (Figma). Other
// text-like fields cap both. Centralized so adding an unbounded field is a one-line change here.
const supportsMaxLength = (type: BlockMenuInputNode["type"] | undefined) => type !== "formTextarea";

const CharacterLimit = () => {
  const { state, actions } = useBlockMenu();
  const { inputNode } = state;
  return (
    <SettingsSubmenu
      icon={<CharacterLimitIcon className="text-foreground/80" />}
      label="Character limit"
    >
      <StepperRow
        label="Min"
        ariaLabel="Min characters"
        value={inputNode?.minLength}
        onChange={actions.updateMinLength}
        min={0}
        max={1000}
        defaultHint={0}
      />
      {supportsMaxLength(inputNode?.type) && (
        <StepperRow
          label="Max"
          ariaLabel="Max characters"
          value={inputNode?.maxLength}
          onChange={actions.updateMaxLength}
          min={0}
          max={1000}
          defaultHint={100}
        />
      )}
    </SettingsSubmenu>
  );
};

const ValueRange = () => {
  const { state, actions } = useBlockMenu();
  const { inputNode } = state;
  return (
    <SettingsSubmenu
      icon={<SelectionLimitIcon className="text-foreground/80" />}
      label="Value range"
    >
      <StepperRow
        label="Min"
        ariaLabel="Min value"
        value={inputNode?.minValue}
        onChange={actions.updateMinValue}
        min={0}
        max={999999}
        defaultHint={0}
      />
      <StepperRow
        label="Max"
        ariaLabel="Max value"
        value={inputNode?.maxValue}
        onChange={actions.updateMaxValue}
        min={0}
        max={999999}
        defaultHint={100}
      />
    </SettingsSubmenu>
  );
};

// Number "Format" submenu (Figma node 25597-9617): independent single-selects for the format
// type (Off + presets), decimal separator, and thousands separator, split by section headers.
const NUMBER_DECIMAL_CHOICES: { value: DecimalSeparator; label: string }[] = [
  { value: ".", label: "0.1" },
  { value: ",", label: "0,1" },
];
const NUMBER_THOUSANDS_CHOICES: { value: ThousandsSeparator; label: string }[] = [
  { value: "none", label: "1000" },
  { value: "comma", label: "1,000" },
  { value: "space", label: "1 000" },
];
const NUMBER_FORMAT_CHOICES: { value: NumberFormatType; label: string }[] = [
  { value: "number", label: "Number" },
  { value: "percent", label: "Percent" },
  { value: "usd", label: "US Dollar" },
  { value: "eur", label: "Euro" },
  { value: "gbp", label: "Pound" },
  { value: "custom", label: "Custom" },
];

const FormatChoiceRow = ({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) => (
  <DropdownMenuItem closeOnClick={false} className="text-foreground/80" onClick={onSelect}>
    <span className="min-w-0 flex-1 text-left">{label}</span>
    {active && <CheckIcon className="size-4 shrink-0 text-foreground/80" />}
  </DropdownMenuItem>
);

const FormatSectionHeader = ({ label }: { label: string }) => (
  <div className="px-2 pt-2 pb-0.5 text-[12px] text-muted-foreground">{label}</div>
);

const NumberFormat = () => {
  const { open, onPointerEnter, onPointerLeave } = useHoverSubmenu();
  const { state, actions } = useBlockMenu();
  const format = state.inputNode?.numberFormat ?? "off";
  const decimal = state.inputNode?.decimalSeparator ?? ".";
  const thousands = state.inputNode?.thousandsSeparator ?? "none";
  // Decimal separator is meaningless without decimals — hide it unless "Allow decimals" is on.
  const allowDecimals = state.inputNode?.allowDecimals !== false;
  return (
    <DropdownMenuSub open={open}>
      <DropdownMenuSubTrigger
        className="text-sm text-foreground/80"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <HashIcon className="size-4 text-foreground/80" />
        <span className="flex-1 text-left">Format</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="max-h-[340px] w-[200px] overflow-y-auto"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <FormatChoiceRow
          label="Off"
          active={format === "off"}
          onSelect={() => actions.setNumberFormat({ format: "off" })}
        />
        {allowDecimals && (
          <>
            <FormatSectionHeader label="Decimal separator" />
            {NUMBER_DECIMAL_CHOICES.map((choice) => (
              <FormatChoiceRow
                key={choice.value}
                label={choice.label}
                active={decimal === choice.value}
                onSelect={() => actions.setNumberFormat({ decimalSeparator: choice.value })}
              />
            ))}
          </>
        )}
        <FormatSectionHeader label="Thousands separator" />
        {NUMBER_THOUSANDS_CHOICES.map((choice) => (
          <FormatChoiceRow
            key={choice.value}
            label={choice.label}
            active={thousands === choice.value}
            onSelect={() => actions.setNumberFormat({ thousandsSeparator: choice.value })}
          />
        ))}
        <FormatSectionHeader label="Formats" />
        {NUMBER_FORMAT_CHOICES.map((choice) => (
          <FormatChoiceRow
            key={choice.value}
            label={choice.label}
            active={format === choice.value}
            onSelect={() => actions.setNumberFormat({ format: choice.value })}
          />
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

const SelectionLimit = () => {
  const { state, actions } = useBlockMenu();
  const { inputNode } = state;
  return (
    <SettingsSubmenu
      icon={<SelectionLimitIcon className="text-foreground/80" />}
      label="Selection limit"
    >
      <StepperRow
        label="Min"
        ariaLabel="Min selections"
        value={inputNode?.minSelections}
        onChange={actions.updateMinSelections}
        min={0}
        max={50}
        defaultHint={0}
      />
      <StepperRow
        label="Max"
        ariaLabel="Max selections"
        value={inputNode?.maxSelections}
        onChange={actions.updateMaxSelections}
        min={0}
        max={50}
        defaultHint={3}
      />
    </SettingsSubmenu>
  );
};

const ShuffleOptions = () => {
  const { state, actions } = useBlockMenu();
  return (
    <SwitchRow
      icon={<ShuffleOptionsIcon className="text-foreground/80" />}
      label="Shuffle options"
      ariaLabel="Shuffle options"
      checked={Boolean(state.inputNode?.randomizeOrder)}
      onToggle={actions.toggleRandomizeOrder}
    />
  );
};

// Per-option auto label style (Figma node 25472-18146): single-select Off / Letters / Numbers.
const OPTION_LABEL_CHOICES: { value: OptionLabelStyle; label: string }[] = [
  { value: "none", label: "Off" },
  { value: "letters", label: "Letters" },
  { value: "numbers", label: "Numbers" },
];

const OptionLabels = () => {
  const { open, onPointerEnter, onPointerLeave } = useHoverSubmenu();
  const { state, actions } = useBlockMenu();
  // Mirror the editor's default: multiChoice shows letters until changed, others none.
  const current: OptionLabelStyle =
    state.inputNode?.optionLabel ??
    (state.inputNode?.variant === "multiChoice" ? "letters" : "none");
  return (
    <DropdownMenuSub open={open}>
      <DropdownMenuSubTrigger
        className="text-sm text-foreground/80"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <LabelsIcon className="text-foreground/80" />
        <span className="flex-1 text-left">Labels</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="w-[160px]"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {OPTION_LABEL_CHOICES.map((choice) => (
          <DropdownMenuItem
            key={choice.value}
            closeOnClick={false}
            className="text-foreground/80"
            onClick={() => actions.setOptionLabel(choice.value)}
          >
            <span className="min-w-0 flex-1 text-left">{choice.label}</span>
            {current === choice.value && (
              <CheckIcon className="size-4 shrink-0 text-foreground/80" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

// Toggles per-option image slots for the whole group; each option then uploads its own image inline.
const OptionImage = () => {
  const { state, actions } = useBlockMenu();
  const enabled = state.inputNode?.showImage === true;
  return (
    <DropdownMenuItem
      closeOnClick={false}
      className="text-foreground/80"
      onClick={actions.toggleOptionImage}
    >
      <PhotoIcon className="text-foreground/80" />
      <span className="min-w-0 flex-1 text-left">Image</span>
      {enabled ? (
        <CheckIcon className="size-4 shrink-0 text-foreground/80" />
      ) : (
        <span className="shrink-0 text-muted-foreground">Upload</span>
      )}
    </DropdownMenuItem>
  );
};

// File-upload "Selection limit" submenu (Figma node 25633-11549): max file size + max file count.
const FileSelectionLimit = () => {
  const { state, actions } = useBlockMenu();
  const { inputNode } = state;
  return (
    <SettingsSubmenu
      icon={<SelectionLimitIcon className="text-foreground/80" />}
      label="Selection limit"
    >
      <StepperRow
        label="Max size (MB)"
        ariaLabel="Max file size in MB"
        value={inputNode?.maxFileSize}
        onChange={actions.updateMaxFileSize}
        min={1}
        max={50}
        defaultHint={10}
      />
      <StepperRow
        label="Max files"
        ariaLabel="Max files"
        value={inputNode?.maxFiles}
        onChange={actions.updateMaxFiles}
        min={1}
        max={20}
        defaultHint={1}
      />
    </SettingsSubmenu>
  );
};

// File-upload "Allowed files" submenu (Figma node 25633-11852): a categorized extension allow-list.
// Empty selection ⇒ every extension is implicitly allowed (and shown active), so toggling narrows
// down. Each category's "All" row flips the whole group.
const AllowedFiles = () => {
  const { open, onPointerEnter, onPointerLeave } = useHoverSubmenu();
  const { state, actions } = useBlockMenu();
  const selected = (state.inputNode?.allowedFileExtensions ?? []).filter((e) => e.startsWith("."));
  const allActive = selected.length === 0;
  const isActive = (ext: string) => allActive || selected.includes(ext);
  // Baseline to toggle against — the implicit full set when nothing is explicitly chosen yet.
  const baseline = () => (allActive ? [...ALL_FILE_EXTENSIONS] : selected);

  const toggleExtension = (ext: string) => {
    const base = baseline();
    actions.setAllowedExtensions(
      base.includes(ext) ? base.filter((e) => e !== ext) : [...base, ext],
    );
  };
  const toggleCategory = (extensions: string[]) => {
    const base = baseline();
    const allIn = extensions.every((e) => base.includes(e));
    actions.setAllowedExtensions(
      allIn ? base.filter((e) => !extensions.includes(e)) : [...base, ...extensions],
    );
  };

  return (
    <DropdownMenuSub open={open}>
      <DropdownMenuSubTrigger
        className="text-sm text-foreground/80"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <FileIcon className="size-4 text-foreground/80" />
        <span className="flex-1 text-left">Allowed files</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className="max-h-[340px] w-[200px] overflow-y-auto"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        {FILE_CATEGORIES.map((category) => {
          const exts = category.extensions.map((e) => e.ext);
          const allCategoryActive = exts.every((e) => isActive(e));
          return (
            <React.Fragment key={category.id}>
              <FormatSectionHeader label={category.label} />
              <DropdownMenuItem
                closeOnClick={false}
                className="text-foreground/80"
                onClick={() => toggleCategory(exts)}
              >
                <span className="min-w-0 flex-1 text-left">All</span>
                {allCategoryActive && <CheckIcon className="size-4 shrink-0 text-foreground/80" />}
              </DropdownMenuItem>
              {category.extensions.map((e) => (
                <DropdownMenuItem
                  key={`${category.id}${e.ext}`}
                  closeOnClick={false}
                  className="text-foreground/80"
                  onClick={() => toggleExtension(e.ext)}
                >
                  <span className="min-w-0 flex-1 text-left">{e.ext}</span>
                  {isActive(e.ext) && <CheckIcon className="size-4 shrink-0 text-foreground/80" />}
                </DropdownMenuItem>
              ))}
            </React.Fragment>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

const ButtonName = () => {
  const { state, actions } = useBlockMenu();
  return (
    <div className="space-y-2 px-2 py-1.5">
      <Label className="text-[12px] text-muted-foreground">Button Name</Label>
      <Input
        value={state.buttonText}
        onChange={(e) => actions.updateButtonText(e.target.value)}
        onKeyDown={stopKeyEventPropagation}
        placeholder="Enter button name"
        className="h-8 rounded-lg text-[13px]"
      />
    </div>
  );
};

const MenuDivider = () => <DropdownMenuSeparator />;

// Bulk insert options (Figma node 25644-10036) — option-group action; sits between
// "Add conditional logic" and "Duplicate", so variants inject it via MenuActions' slot.
const BulkInsertOptions = () => {
  const { actions } = useBlockMenu();
  return (
    <DropdownMenuItem className="text-foreground/80" onClick={actions.openBulkInsert}>
      <BulkInsertIcon />
      <span className="flex-1 text-left">Bulk insert options</span>
      <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
    </DropdownMenuItem>
  );
};

// "Add Options" dialog (Figma node 25578-11410): paste one option per line, Save splices them
// into the option group. Self-contained — its open state lives in BlockMenu so it survives the
// menu closing.
const BulkInsertDialog = ({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) => {
  const [value, setValue] = React.useState("");
  React.useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  const canSave = value.trim().length > 0;
  const save = () => {
    if (canSave) onSubmit(value);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent showCloseButton={false} className="gap-5 rounded-[20px] p-5 sm:max-w-[420px]">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-[18px]">Add Options</DialogTitle>
          <DialogDescription className="mt-0 text-[14px] leading-normal text-gray-700">
            Write or paste your options below. Each option must be on a separate line.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          // ⌘/Ctrl+Enter saves; plain Enter must add a new line (one option per line).
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              save();
            }
          }}
          placeholder="Type each options on a new line"
          className="h-[180px] resize-none rounded-[12px] bg-muted shadow-none focus-visible:ring-0"
        />
        <div className="flex justify-end">
          <Button onClick={save} disabled={!canSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// `children` are rendered right after "Add conditional logic" — option menus slot the
// "Bulk insert options" action in there to match Figma's ordering.
const MenuActions = ({ children }: { children?: React.ReactNode }) => {
  const { actions } = useBlockMenu();
  const {
    open: turnIntoOpen,
    onPointerEnter: onEnter,
    onPointerLeave: onLeave,
  } = useHoverSubmenu();

  return (
    <>
      {/* Repeatable sits at the top of the shared actions, just below the essentials divider —
          self-hides for non-scalar fields, so it shows wherever it applies. */}
      <RepeatableToggle />
      <DropdownMenuItem className="text-foreground/80" onClick={actions.addLogic}>
        <ConditionalLogicIcon />
        <span className="flex-1 text-left">Add conditional logic</span>
        <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
      </DropdownMenuItem>
      {children}
      <DropdownMenuItem className="text-foreground/80" onClick={actions.duplicateBlock}>
        <DuplicateIcon />
        <span className="flex-1 text-left">Duplicate</span>
        <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem className="text-foreground/80" onClick={actions.hide}>
        <HideIcon />
        <span className="flex-1 text-left">Hide</span>
        <DropdownMenuShortcut>⌘H</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem className="text-foreground/80" onClick={actions.deleteBlock}>
        <DeleteIcon />
        <span className="flex-1 text-left">Delete</span>
        <DropdownMenuShortcut>Del</DropdownMenuShortcut>
      </DropdownMenuItem>

      <DropdownMenuSub open={turnIntoOpen}>
        <DropdownMenuSubTrigger
          className="text-sm text-foreground/80"
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
        >
          <TurnIntoIcon />
          <span className="flex-1 text-left">Turn into</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent onPointerEnter={onEnter} onPointerLeave={onLeave}>
          <DropdownMenuItem onClick={() => actions.turnInto(KEYS.p)}>Paragraph</DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.turnInto(KEYS.h1)}>Heading 1</DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.turnInto(KEYS.h2)}>Heading 2</DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.turnInto(KEYS.h3)}>Heading 3</DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.turnInto(KEYS.blockquote)}>
            Blockquote
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
};

/* ── Field-type variants — explicit compositions; add a field type by adding one here ── */

const TextFieldMenu = () => (
  <>
    <RequiredToggle />
    <CharacterLimit />
    <MenuDivider />
    <MenuActions />
  </>
);

// Email: required + a "Verify email" toggle (Figma node 25632-9562). No repeatable/char-limit.
const EmailFieldMenu = () => (
  <>
    <RequiredToggle />
    <VerifyEmail />
    <MenuDivider />
    <MenuActions />
  </>
);

// Date: a required scalar with no extra settings (Repeatable comes from MenuActions).
const ScalarFieldMenu = () => (
  <>
    <RequiredToggle />
    <MenuDivider />
    <MenuActions />
  </>
);

const Use24HourToggle = () => {
  const { state, actions } = useBlockMenu();
  return (
    <SwitchRow
      icon={<ClockLineIcon className="text-foreground/80" />}
      label="24-hour time"
      ariaLabel="24-hour time"
      checked={Boolean(state.inputNode?.use24Hour)}
      onToggle={actions.toggleUse24Hour}
    />
  );
};

// Time: scalar + a 12h/24h (railway) toggle.
const TimeFieldMenu = () => (
  <>
    <RequiredToggle />
    <Use24HourToggle />
    <MenuDivider />
    <MenuActions />
  </>
);

// Phone (Figma node 25632-9765): required + a default-country-code picker. No "Verify email".
const PhoneFieldMenu = () => (
  <>
    <RequiredToggle />
    <DefaultCountryCode />
    <MenuDivider />
    <MenuActions />
  </>
);

// Decimals on by default; toggling off enforces integer-only validation (see allowDecimals usage).
const AllowDecimals = () => {
  const { state, actions } = useBlockMenu();
  return (
    <SwitchRow
      icon={<DecimalsArrowRightIcon className="size-4 text-foreground/80" />}
      label="Allow decimals"
      ariaLabel="Allow decimals"
      checked={state.inputNode?.allowDecimals !== false}
      onToggle={actions.toggleAllowDecimals}
    />
  );
};

const NumberFieldMenu = () => (
  <>
    <RequiredToggle />
    <NumberFormat />
    <AllowDecimals />
    <ValueRange />
    <MenuDivider />
    <MenuActions />
  </>
);

const FileFieldMenu = () => (
  <>
    <RequiredToggle />
    <FileSelectionLimit />
    <AllowedFiles />
    <MenuDivider />
    <MenuActions />
  </>
);

const CheckboxFieldMenu = () => (
  <>
    <RequiredToggle />
    <ShuffleOptions />
    <SelectionLimit />
    <OptionLabels />
    <OptionImage />
    <MenuDivider />
    <MenuActions>
      <BulkInsertOptions />
    </MenuActions>
  </>
);

const MultiSelectFieldMenu = () => (
  <>
    <RequiredToggle />
    <SelectionLimit />
    <MenuDivider />
    <MenuActions />
  </>
);

const MultiChoiceFieldMenu = () => (
  <>
    <RequiredToggle />
    <ShuffleOptions />
    <SelectionLimit />
    <OptionLabels />
    <OptionImage />
    <MenuDivider />
    <MenuActions>
      <BulkInsertOptions />
    </MenuActions>
  </>
);

// Ranking: required option field, no min/max or extra toggles.
const RankingFieldMenu = () => (
  <>
    <RequiredToggle />
    <MenuDivider />
    <MenuActions />
  </>
);

const ButtonFieldMenu = () => (
  <>
    <ButtonName />
    <MenuDivider />
    <MenuActions />
  </>
);

// Static (headings/paragraph/quote) and unknown blocks: actions only.
const StaticFieldMenu = () => <MenuActions />;

const FIELD_MENU_VARIANTS: Record<BlockFieldType, React.FC> = {
  textLike: TextFieldMenu,
  formEmail: EmailFieldMenu,
  formPhone: PhoneFieldMenu,
  formDate: ScalarFieldMenu,
  formTime: TimeFieldMenu,
  formNumber: NumberFieldMenu,
  formFileUpload: FileFieldMenu,
  optionCheckbox: CheckboxFieldMenu,
  optionMultiChoice: MultiChoiceFieldMenu,
  optionRanking: RankingFieldMenu,
  formMultiSelect: MultiSelectFieldMenu,
  formButton: ButtonFieldMenu,
  static: StaticFieldMenu,
  unknown: StaticFieldMenu,
};

interface UseBlockMenuContextMenuAndHotkeysOptions {
  triggerRef: React.RefObject<HTMLDivElement | null>;
  api: ReturnType<typeof useEditorPlugin<typeof BlockMenuPlugin>>["api"];
  isOpen: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddLogic: () => void;
  onBulkInsert: () => void;
}

const useBlockMenuContextMenuAndHotkeys = ({
  triggerRef,
  api,
  isOpen,
  onDelete,
  onDuplicate,
  onAddLogic,
  onBulkInsert,
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

  // Shortcuts mirror the labels shown in the menu (⌘C / ⌘D / ⌘H / Del), gated to while it's open.
  useHotkeys("delete, backspace", onDelete, { enabled: isOpen, preventDefault: true }, [
    isOpen,
    onDelete,
  ]);

  useHotkeys("mod+d", onDuplicate, { enabled: isOpen, preventDefault: true }, [
    isOpen,
    onDuplicate,
  ]);

  useHotkeys("mod+h", () => api.blockMenu.hide(), { enabled: isOpen, preventDefault: true }, [
    isOpen,
    api.blockMenu,
  ]);

  useHotkeys("mod+c", onAddLogic, { enabled: isOpen, preventDefault: true }, [isOpen, onAddLogic]);

  useHotkeys("mod+o", onBulkInsert, { enabled: isOpen, preventDefault: true }, [
    isOpen,
    onBulkInsert,
  ]);
};

interface BlockMenuFirstNode {
  type?: string;
  variant?: string;
  optionLabel?: OptionLabelStyle;
  numberFormat?: NumberFormatType;
  decimalSeparator?: DecimalSeparator;
  thousandsSeparator?: ThousandsSeparator;
  verifyEmail?: boolean;
  defaultCountryCode?: string;
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
