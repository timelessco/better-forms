import {
  BulkInsertIcon,
  CharacterLimitIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockLineIcon,
  ChevronSelectIcon,
  ConditionalLogicIcon,
  DecimalsArrowRightIcon,
  DeleteIcon,
  DuplicateIcon,
  FileIcon,
  HashIcon,
  HideIcon,
  IconDropdown,
  IconLinearScale,
  IconPhone,
  IconRating,
  LabelsIcon,
  ListTodoIcon,
  PhotoIcon,
  RepeatIcon,
  RequiredFieldIcon,
  ScaleAnchorIcon,
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
import { KEYS } from "platejs";
import { useEditorPlugin, useEditorSelector, useHotkeys, usePluginOption } from "platejs/react";
import * as React from "react";

import { AnimatePresence, m } from "motion/react";

import { AnimatedSize } from "@/components/transitions/animated-size";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import type { OptionLabelStyle } from "@/components/ui/form-option-item-constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLogicBlockNode } from "@/components/ui/logic-block-node";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { registerBlockMenuClose, unregisterBlockMenuClose } from "@/lib/editor/block-menu-close";
import { useReanchorThemeProps } from "@/hooks/use-form-theme";
import { useMountEffect } from "@/hooks/use-mount-effect";
import {
  DEFAULT_FILE_UPLOAD_EXTENSIONS,
  FILE_CATEGORIES,
} from "@/lib/form-schema/file-upload-types";
import {
  ALLOWED_LABEL_TYPES,
  FORM_INPUT_NODE_TYPES,
  LINEAR_SCALE_BOUNDS,
  LINEAR_SCALE_DEFAULTS,
  RATING_DEFAULTS,
  RATING_MAX_STARS,
} from "@/lib/form-schema/form-field-constants";
import type {
  DecimalSeparator,
  NumberFormatConfig,
  NumberFormatType,
  ThousandsSeparator,
} from "@/lib/form-schema/number-format";
import { PHONE_COUNTRIES } from "@/lib/phone/countries";
import { cn } from "@/lib/utils";

type BlockFieldType =
  | "textLike" // formInput, formTextarea, formLink
  | "formEmail"
  | "formPhone"
  | "formNumber"
  | "formDate"
  | "formTime"
  | "formFileUpload"
  | "formLinearScale"
  | "formMatrix"
  | "optionCheckbox" // formOptionItem variant="checkbox"
  | "optionMultiChoice" // formOptionItem variant="multiChoice"
  | "optionRanking" // formOptionItem variant="ranking"
  | "formRating"
  | "formSignature"
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
  if (t === "formLinearScale") return "formLinearScale";
  if (t === "formMatrix") return "formMatrix";
  if (t === "formRating") return "formRating";
  if (t === "formSignature") return "formSignature";
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
  // Width/padding live on the views inside AnimatedSize so the popup can morph between them.
  const themeReanchor = useReanchorThemeProps("w-auto p-0");
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
  // Inline subviews: instead of side flyouts, the popup morphs in place between the menu and the
  // active panel (keyed into INLINE_PANELS). Bulk insert holds the option group's tail + variant
  // captured when entering its view; lines splice in on Save.
  const [view, setView] = React.useState<string | null>(null);
  // Slide axis: panels enter from the trigger's chevron side (+1); back reverses (-1).
  const [direction, setDirection] = React.useState(1);
  // Side + align the popup actually rendered on, frozen right after open. View morphs resize the
  // popup and Base UI re-runs collision logic on every resize — without the lock a menu flipped
  // above the anchor snaps below it when a shorter panel opens. Locking BOTH axes keeps the popup
  // hugging the anchor (same gap), growing away from it. Align must lock too: the drag handle sits
  // in the left gutter, so collision flips align end→start to fit; without locking that flip the
  // lock reverts align to the prop ("end") and the popup clips off the left edge.
  const [lockedSide, setLockedSide] = React.useState<"top" | "bottom" | null>(null);
  const [lockedAlign, setLockedAlign] = React.useState<"start" | "center" | "end" | null>(null);
  const [bulkInsert, setBulkInsert] = React.useState<{ at: number; variant: string } | null>(null);
  const blockMenuTriggerRef = React.useRef<HTMLDivElement | null>(null);

  const changeView = React.useCallback((next: string | null) => {
    setDirection(next === null ? -1 : 1);
    setView(next);
  }, []);

  const { firstNode, firstPath, nodeType, inputNode, fieldType, getInputPath } =
    useBlockMenuSelection({ editor, isOpen });

  // Turn-into swaps the block's type — fine for labels/static text, but converting an actual
  // input node (or the submit button) breaks the form flow, so those never offer it.
  const canTurnInto = !FORM_INPUT_NODE_TYPES.has(nodeType ?? "") && nodeType !== "formButton";

  const [wasOpen, setWasOpen] = React.useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    if (nodeType === "formButton") {
      setButtonText((firstNode?.buttonText as string) || "Submit");
    }
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
    setView(null);
    setBulkInsert(null);
    setLockedSide(null);
    setLockedAlign(null);
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
    // Insert after the whole field, not the selected node. For a choice field the selection may
    // land on a label or a middle option; walk past the trailing option run so the logic block
    // lands below the last option instead of splitting the group.
    const inputPath = getInputPath() ?? firstPath;
    const nodes = editor.children as TElement[];
    let last = inputPath[0];
    while (last < nodes.length - 1 && nodes[last + 1]?.type === "formOptionItem") last++;
    editor.tf.insertNodes(createLogicBlockNode() as unknown as TElement, {
      at: [last + 1],
      select: false,
    });
    api.blockMenu.hide();
  }, [editor, firstPath, getInputPath, api.blockMenu]);

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
    setBulkInsert({ at: lastIndex + 1, variant: startNode.variant || "checkbox" });
    changeView("bulk-insert");
  }, [getInputPath, editor, changeView]);

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
      api.blockMenu.hide();
      // Focus back to the last inserted option, cursor at its end.
      const lastPath = [target.at + labels.length - 1];
      editor.tf.focus();
      const end = editor.api.end(lastPath);
      if (end) editor.tf.select(end);
    },
    [bulkInsert, editor, api.blockMenu],
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

  // Keyboard: Tab/Shift+Tab cycles rows (Base UI only arrow-navigates; Tab would blur-close the
  // popup); Enter activates via Base UI; Escape steps back out of an inline panel first.
  const handleMenuKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && view !== null) {
        e.preventDefault();
        e.stopPropagation();
        changeView(null);
        return;
      }
      if (e.key !== "Tab") return;
      e.preventDefault();
      e.stopPropagation();
      const items = Array.from(
        e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'),
      );
      if (items.length === 0) return;
      const active = document.activeElement;
      const idx = items.findIndex(
        (el) => el === active || (active instanceof Node && el.contains(active)),
      );
      const next = e.shiftKey
        ? items[idx <= 0 ? items.length - 1 : idx - 1]
        : items[idx === -1 || idx === items.length - 1 ? 0 : idx + 1];
      next?.focus();
    },
    [view, changeView],
  );

  // Read which side + align Base UI settled on one frame after open (after collision flips), then
  // lock both for the session so view-morph resizes can't re-flip the popup around the anchor.
  React.useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector('[data-slot="dropdown-menu-content"]');
      const side = el?.getAttribute("data-side");
      const align = el?.getAttribute("data-align");
      if (side === "top" || side === "bottom") setLockedSide(side);
      if (align === "start" || align === "center" || align === "end") setLockedAlign(align);
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

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
      state: { fieldType, inputNode, buttonText, canTurnInto },
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
        toggleShowAsDropdown: handlers.handleToggleShowAsDropdown,
        toggleMultiple: handlers.handleToggleMultiple,
        toggleAllowOther: handlers.handleToggleAllowOther,
        toggleVerifyEmail: handlers.handleToggleVerifyEmail,
        toggleAllowedCountry: handlers.handleToggleAllowedCountry,
        setOptionLabel: handlers.handleSetOptionLabel,
        toggleOptionImage: handlers.handleToggleOptionImage,
        setNumberFormat: handlers.handleSetNumberFormat,
        updateButtonText: handlers.handleUpdateButtonText,
        setScaleRange: handlers.handleSetScaleRange,
        setScaleStep: handlers.handleSetScaleStep,
        setAnchorLabel: handlers.handleSetAnchorLabel,
        updateStarCount: handlers.handleUpdateStarCount,
        deleteBlock: handleDelete,
        duplicateBlock: handleDuplicate,
        addLogic: handleAddLogic,
        hide: handleHide,
        turnInto: handleTurnInto,
        openBulkInsert: handleOpenBulkInsert,
        submitBulkInsert: handleBulkInsertSubmit,
        setView: changeView,
      },
    }),
    [
      fieldType,
      inputNode,
      buttonText,
      canTurnInto,
      handlers,
      handleDelete,
      handleDuplicate,
      handleAddLogic,
      handleHide,
      handleTurnInto,
      handleOpenBulkInsert,
      handleBulkInsertSubmit,
      changeView,
    ],
  );

  const FieldMenu = FIELD_MENU_VARIANTS[fieldType];
  const activePanel = view === null ? null : (INLINE_PANELS[view] ?? null);

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
            className={cn("bf-block-menu", themeReanchor.className)}
            style={themeReanchor.style}
            // Pre-lock: collision-aware placement off the click point (flips side AND align to fit).
            // Locked: keep the settled side + align with avoidance off, so view morphs grow away
            // from the anchor instead of flipping the popup around it.
            align={lockedAlign ?? "end"}
            side={lockedSide ?? "bottom"}
            sideOffset={8}
            collisionAvoidance={
              lockedSide ? { side: "none", align: "none", fallbackAxisSide: "none" } : undefined
            }
            onKeyDown={handleMenuKeyDown}
          >
            <BlockMenuContext value={contextValue}>
              <AnimatedSize>
                <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                  {activePanel === null ? (
                    <m.div
                      key="menu"
                      className="w-[246px] p-1"
                      custom={direction}
                      variants={slideVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      <FieldMenu />
                    </m.div>
                  ) : (
                    <m.div
                      key={view}
                      // Figma 25634-17867: subpanel card padding 16/14/14 (t/x/b), 12px gap header→body.
                      className={cn(
                        "flex flex-col gap-3 px-3.5 pt-4 pb-3.5",
                        activePanel.width ?? "w-[246px]",
                      )}
                      custom={direction}
                      variants={slideVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      <PanelHeader label={activePanel.label} />
                      <activePanel.Panel />
                    </m.div>
                  )}
                </AnimatePresence>
              </AnimatedSize>
            </BlockMenuContext>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
  allowedCountries?: string[];
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
  showAsDropdown?: boolean;
  allowOther?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleStep?: number;
  anchorLeft?: string;
  anchorCenter?: string;
  anchorRight?: string;
  starCount?: number;
  multiple?: boolean;
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

  // Linear scale start/end — set together from the dual-handle slider. Unlike
  // updateNumericNode, 0 and negatives are valid values, so always set (never unset).
  const handleSetScaleRange = React.useCallback(
    (min: number, max: number) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      editor.tf.setNodes({ scaleMin: min, scaleMax: max }, { at: inputPath });
    },
    [getInputPath, editor.tf],
  );
  const handleSetScaleStep = React.useCallback(
    (step: number) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      // Never persist a non-finite step (e.g. a stray NaN from the slider) — it'd render "NaN".
      const safeStep = Number.isFinite(step) ? Math.max(1, step) : LINEAR_SCALE_DEFAULTS.step;
      editor.tf.setNodes({ scaleStep: safeStep }, { at: inputPath });
    },
    [getInputPath, editor.tf],
  );
  // Linear scale anchor labels (Figma 26153-13445) — written per keystroke; empty unsets so
  // the anchor row under the scale hides.
  const handleSetAnchorLabel = React.useCallback(
    (key: "anchorLeft" | "anchorCenter" | "anchorRight", value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      if (value) editor.tf.setNodes({ [key]: value }, { at: inputPath });
      else editor.tf.unsetNodes([key], { at: inputPath });
    },
    [getInputPath, editor.tf],
  );
  // Star count — default of 5 (never unset), clamped to 1…RATING_MAX_STARS.
  const handleUpdateStarCount = React.useCallback(
    (value: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const num = parseInt(value, 10) || RATING_DEFAULTS.starCount;
      const clamped = Math.min(RATING_MAX_STARS, Math.max(1, num));
      editor.tf.setNodes({ starCount: clamped }, { at: inputPath });
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
  // Display mode lives on the group's FIRST option node (where the transforms read it), so
  // resolve the group start instead of writing to whichever option row anchored the menu.
  // Mutually exclusive with "Image": a dropdown can't present image tiles.
  const handleToggleShowAsDropdown = React.useCallback(() => {
    const inputPath = getInputPath();
    if (!inputPath) return;
    let first = inputPath[0];
    const nodes = editor.children as TElement[];
    if (nodes[first]?.type !== "formOptionItem") return;
    while (first > 0 && nodes[first - 1]?.type === "formOptionItem") first--;
    let last = first;
    while (last < nodes.length - 1 && nodes[last + 1]?.type === "formOptionItem") last++;
    const enabled = (nodes[first] as { showAsDropdown?: boolean }).showAsDropdown === true;
    editor.tf.withoutNormalizing(() => {
      if (enabled) {
        editor.tf.unsetNodes(["showAsDropdown"], { at: [first] });
        return;
      }
      editor.tf.setNodes({ showAsDropdown: true } as Partial<TElement>, { at: [first] });
      for (let i = first; i <= last; i++) editor.tf.unsetNodes(["showImage"], { at: [i] });
    });
  }, [getInputPath, editor]);
  const handleToggleMultiple = React.useCallback(
    () => toggleBooleanNode("multiple"),
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

  // Allowed countries — toggle an ISO code in the whitelist. Empty ⇒ unset ⇒ all countries
  // allowed, auto-detected from the browser locale.
  const handleToggleAllowedCountry = React.useCallback(
    (code: string) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const current = inputNode?.allowedCountries;
      const next = current?.includes(code)
        ? current.filter((c) => c !== code)
        : [...(current ?? []), code];
      if (next.length > 0) {
        editor.tf.setNodes({ allowedCountries: next }, { at: inputPath });
      } else {
        editor.tf.unsetNodes(["allowedCountries"], { at: inputPath });
      }
    },
    [getInputPath, inputNode?.allowedCountries, editor.tf],
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
  // Mutually exclusive with "Show as dropdown": a dropdown can't present image tiles.
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
      if (!enabled) editor.tf.unsetNodes(["showAsDropdown"], { at: [first] });
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

  // Allowed files — store the flat extension allow-list. Empty ⇒ unset, which the runtime treats
  // as the image-only default. Also clears any legacy allowedFileTypes category.
  const handleSetAllowedExtensions = React.useCallback(
    (next: string[]) => {
      const inputPath = getInputPath();
      if (!inputPath) return;
      const deduped = [...new Set(next)];
      if (deduped.length === 0) {
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
      handleToggleShowAsDropdown,
      handleToggleMultiple,
      handleToggleAllowOther,
      handleToggleVerifyEmail,
      handleToggleAllowedCountry,
      handleSetOptionLabel,
      handleToggleOptionImage,
      handleSetNumberFormat,
      handleUpdateButtonText,
      handleSetScaleRange,
      handleSetScaleStep,
      handleSetAnchorLabel,
      handleUpdateStarCount,
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
      handleToggleShowAsDropdown,
      handleToggleMultiple,
      handleToggleAllowOther,
      handleToggleVerifyEmail,
      handleToggleAllowedCountry,
      handleSetOptionLabel,
      handleToggleOptionImage,
      handleSetNumberFormat,
      handleUpdateButtonText,
      handleSetScaleRange,
      handleSetScaleStep,
      handleSetAnchorLabel,
      handleUpdateStarCount,
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
  toggleShowAsDropdown: () => void;
  toggleMultiple: () => void;
  toggleAllowOther: () => void;
  toggleVerifyEmail: () => void;
  toggleAllowedCountry: (code: string) => void;
  setOptionLabel: (style: OptionLabelStyle) => void;
  toggleOptionImage: () => void;
  setNumberFormat: (patch: Partial<NumberFormatConfig>) => void;
  updateButtonText: (v: string) => void;
  setScaleRange: (min: number, max: number) => void;
  setScaleStep: (step: number) => void;
  setAnchorLabel: (key: "anchorLeft" | "anchorCenter" | "anchorRight", value: string) => void;
  updateStarCount: (v: string) => void;
  deleteBlock: () => void;
  duplicateBlock: () => void;
  addLogic: () => void;
  hide: () => void;
  turnInto: (type: string) => void;
  openBulkInsert: () => void;
  submitBulkInsert: (text: string) => void;
  /** Switch the popup's inline view: an INLINE_PANELS id, or null for the menu. */
  setView: (view: string | null) => void;
}

interface BlockMenuContextValue {
  state: {
    fieldType: BlockFieldType;
    inputNode: BlockMenuInputNode | null | undefined;
    buttonText: string;
    /** Selected block may type-swap — false on actual input nodes and the submit button. */
    canTurnInto: boolean;
  };
  actions: BlockMenuActions;
}

const BlockMenuContext = React.createContext<BlockMenuContextValue | null>(null);

const useBlockMenu = (): BlockMenuContextValue => {
  const ctx = React.use(BlockMenuContext);
  if (!ctx) throw new Error("BlockMenu pieces must be rendered inside <BlockMenu>");
  return ctx;
};

// Inline subview slide: panels enter from the trigger's chevron side (>), back reverses.
const slideVariants = {
  initial: (dir: number) => ({ opacity: 0, x: 24 * dir }),
  animate: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -24 * dir }),
};

// Trigger row for an inline subview — replaces the old side-flyout submenus: the popup itself
// morphs into the panel (AnimatedSize + slide) instead of opening a second popup.
const SubmenuRow = ({
  icon,
  label,
  view,
}: {
  icon: React.ReactNode;
  label: string;
  view: string;
}) => {
  const { actions } = useBlockMenu();
  return (
    <DropdownMenuItem
      closeOnClick={false}
      className="text-sm text-gray-800"
      onClick={() => actions.setView(view)}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <ChevronRightIcon className="size-4 shrink-0 text-gray-800" />
    </DropdownMenuItem>
  );
};

// Back header shown above every inline panel.
const PanelHeader = ({ label }: { label: string }) => {
  const { actions } = useBlockMenu();
  return (
    <button
      type="button"
      onClick={() => actions.setView(null)}
      className="flex w-full items-center gap-0.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeftIcon className="-ms-0.5 size-4" />
      <span>{label}</span>
    </button>
  );
};

// Standard layout for numeric-settings panels (StepperRows etc.).
const PanelBody = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-2.5">{children}</div>
);

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

// How long an out-of-range value stays visible (red) before snapping back to the limit.
const STEPPER_RESET_MS = 1500;

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
  // While the typed value is out of range we hold it locally (red) instead of persisting, so
  // the user sees what they entered and *why* it's wrong before it resets to the limit.
  const [draft, setDraft] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const draftRef = React.useRef<string | null>(null); // mirrors `draft` for timer/blur callbacks
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const setDraftValue = (v: string | null) => {
    draftRef.current = v;
    setDraft(v);
  };
  const clearReset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
  };
  React.useEffect(() => clearReset, []);

  // Persist a known-good value and drop the local draft/error so we follow the node again.
  const commit = (raw: string) => {
    clearReset();
    setDraftValue(null);
    setError(null);
    onChange(raw);
  };

  // Clamp whatever's in the draft to the allowed range and persist it (blur or reset timer).
  const resolveDraft = () => {
    clearReset();
    const current = draftRef.current;
    setDraftValue(null);
    setError(null);
    if (current === null) return;
    const n = Number.parseInt(current, 10);
    if (Number.isNaN(n)) {
      onChange(""); // handler applies the field's default
      return;
    }
    let next = n;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    onChange(String(next));
  };

  const handleChange = (raw: string) => {
    clearReset();
    setDraftValue(raw);
    const n = Number.parseInt(raw, 10);
    if (raw === "" || Number.isNaN(n)) {
      setError(null); // let a blank settle to its default on blur
      return;
    }
    const tooHigh = max !== undefined && n > max;
    const tooLow = min !== undefined && n < min;
    if (tooHigh || tooLow) {
      setError(tooHigh ? `Maximum is ${max}` : `Minimum is ${min}`);
      resetTimer.current = setTimeout(resolveDraft, STEPPER_RESET_MS);
      return;
    }
    commit(raw); // in range → persist live
  };

  const step = (delta: number) => {
    let next = (value ?? defaultHint ?? 0) + delta;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    commit(String(next));
  };

  const display = draft ?? (value !== undefined ? String(value) : "");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 text-[14px] font-medium text-foreground">{label}</span>
        <div
          className={cn(
            "flex w-[140px] items-center gap-2 rounded-lg px-2 py-1.5",
            error ? "bg-destructive/10 ring-1 ring-destructive" : "bg-(--color-gray-alpha-100)",
          )}
        >
          <input
            type="number"
            min={min}
            max={max}
            value={display}
            placeholder={defaultHint !== undefined ? String(defaultHint) : undefined}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={resolveDraft}
            onKeyDown={stopKeyEventPropagation}
            onClick={stopMouseEventPropagation}
            onPointerDown={stopMouseEventPropagation}
            aria-label={ariaLabel}
            aria-invalid={error !== null}
            className={cn(
              "min-w-0 flex-1 [appearance:textfield] bg-transparent text-[14px] font-medium outline-none placeholder:text-muted-foreground/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              error ? "text-destructive" : "text-foreground",
            )}
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
      {error ? <p className="text-right text-[12px] text-destructive">{error}</p> : null}
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
  <DropdownMenuItem
    closeOnClick={false}
    onClick={onToggle}
    inset={icon ? undefined : true}
    aria-label={ariaLabel}
  >
    {icon}
    <span className="min-w-0 flex-1 text-left text-gray-800">{label}</span>
    {/* Visual only — the row owns the click. An interactive Switch double-fires: Base UI's menu
        item activates on the native click before React's stopPropagation runs, so a direct switch
        click toggled twice (= no visible change). */}
    <Switch
      aria-hidden
      tabIndex={-1}
      size="sm"
      className={cn(SWITCH_OFF_TRACK, "pointer-events-none")}
      checked={checked}
    />
  </DropdownMenuItem>
);

/* ── Compound pieces — each reads only what it needs from `useBlockMenu()` ── */

const RequiredToggle = () => {
  const { state, actions } = useBlockMenu();
  return (
    <SwitchRow
      icon={<RequiredFieldIcon className="text-gray-800" />}
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
      icon={<VerifiedIcon className="text-gray-800" />}
      label="Verify email"
      ariaLabel="Verify email"
      checked={Boolean(state.inputNode?.verifyEmail)}
      onToggle={actions.toggleVerifyEmail}
    />
  );
};

// Allowed countries (Figma node 25633-9894): searchable, multi-select country whitelist. The
// chosen ISO codes are the only options shown in the live phone input's country dropdown; none
// selected ⇒ all countries, auto-detected from locale. Search header stays pinned while scrolling.
const DefaultCountryCode = () => (
  <SubmenuRow
    icon={<IconPhone className="text-gray-800" />}
    label="Allowed countries"
    view="default-country-code"
  />
);

const DefaultCountryCodePanel = () => {
  const { state, actions } = useBlockMenu();
  const [search, setSearch] = React.useState("");
  const selected = state.inputNode?.allowedCountries;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q),
    );
  }, [search]);

  return (
    <div className="p-1">
      <div className="flex h-7 items-center gap-1.5 rounded-lg bg-secondary px-2 focus-within:ring-2 focus-within:ring-ring/50">
        <SearchLineIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={stopKeyEventPropagation}
          onPointerDown={stopMouseEventPropagation}
          placeholder="Search"
          aria-label="Search countries"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      {/* Multi-select whitelist. None selected ⇒ all countries allowed, auto-detected from the
          browser locale (wired in phone-input.tsx) — that's the implicit default, no explicit row. */}
      <div className="mt-1 max-h-[260px] overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No country found.</div>
        ) : (
          filtered.map((c) => (
            <DropdownMenuItem
              key={c.code}
              closeOnClick={false}
              className="text-gray-800"
              onClick={() => actions.toggleAllowedCountry(c.code)}
            >
              <span aria-hidden className="shrink-0 text-base leading-none">
                {c.flag}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">
                {c.name} (+{c.dialCode})
              </span>
              {selected?.includes(c.code) && (
                <CheckIcon className="size-4 shrink-0 text-gray-800" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </div>
    </div>
  );
};

const RepeatableToggle = () => {
  const { state, actions } = useBlockMenu();
  // Only the scalar field types map to a repeatable PlateFormField (see transform-plate-to-form.ts).
  if (!REPEATABLE_BLOCK_FIELD_TYPES.has(state.fieldType)) return null;
  return (
    <SwitchRow
      icon={<RepeatIcon className="size-4 text-gray-800" />}
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

const CharacterLimit = () => (
  <SubmenuRow
    icon={<CharacterLimitIcon className="text-gray-800" />}
    label="Character limit"
    view="character-limit"
  />
);

const CharacterLimitPanel = () => {
  const { state, actions } = useBlockMenu();
  const { inputNode } = state;
  return (
    <PanelBody>
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
    </PanelBody>
  );
};

const ValueRange = () => (
  <SubmenuRow
    icon={<SelectionLimitIcon className="text-gray-800" />}
    label="Value range"
    view="value-range"
  />
);

const ValueRangePanel = () => {
  const { state, actions } = useBlockMenu();
  const { inputNode } = state;
  return (
    <PanelBody>
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
    </PanelBody>
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
  <DropdownMenuItem closeOnClick={false} className="text-gray-800" onClick={onSelect}>
    <span className="min-w-0 flex-1 text-left">{label}</span>
    {active && <CheckIcon className="size-4 shrink-0 text-gray-800" />}
  </DropdownMenuItem>
);

const FormatSectionHeader = ({ label }: { label: string }) => (
  <div className="px-2 pt-2 pb-0.5 text-[12px] text-muted-foreground">{label}</div>
);

const NumberFormat = () => (
  <SubmenuRow
    icon={<HashIcon className="size-4 text-gray-800" />}
    label="Format"
    view="number-format"
  />
);

const NumberFormatPanel = () => {
  const { state, actions } = useBlockMenu();
  const format = state.inputNode?.numberFormat ?? "off";
  const decimal = state.inputNode?.decimalSeparator ?? ".";
  const thousands = state.inputNode?.thousandsSeparator ?? "none";
  // Decimal separator is meaningless without decimals — hide it unless "Allow decimals" is on.
  const allowDecimals = state.inputNode?.allowDecimals !== false;
  return (
    <div className="max-h-[340px] overflow-y-auto overscroll-contain p-1">
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
    </div>
  );
};

const SelectionLimit = () => (
  <SubmenuRow
    icon={<SelectionLimitIcon className="text-gray-800" />}
    label="Selection limit"
    view="selection-limit"
  />
);

const SelectionLimitPanel = () => {
  const { state, actions } = useBlockMenu();
  const { inputNode } = state;
  return (
    <PanelBody>
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
    </PanelBody>
  );
};

const ShuffleOptions = () => {
  const { state, actions } = useBlockMenu();
  return (
    <SwitchRow
      icon={<ShuffleOptionsIcon className="text-gray-800" />}
      label="Shuffle options"
      ariaLabel="Shuffle options"
      checked={Boolean(state.inputNode?.randomizeOrder)}
      onToggle={actions.toggleRandomizeOrder}
    />
  );
};

// Display mode (Figma 25632:9327/9452): the live form renders the option group as a dropdown —
// single-select for Multi-choice, multi-select for Checkbox. Pure presentation; answers unchanged.
const ShowAsDropdown = () => {
  const { state, actions } = useBlockMenu();
  return (
    <SwitchRow
      icon={<IconDropdown className="text-gray-800" />}
      label="Show as dropdown"
      ariaLabel="Show as dropdown"
      checked={Boolean(state.inputNode?.showAsDropdown)}
      onToggle={actions.toggleShowAsDropdown}
    />
  );
};

// Matrix "Multiple selection" (Figma node 25646-14665): off ⇒ one column per row (radio);
// on ⇒ several columns per row (checkbox). Stored as `multiple` on the formMatrix node.
const MultipleSelection = () => {
  const { state, actions } = useBlockMenu();
  return (
    <SwitchRow
      icon={<ListTodoIcon className="text-gray-800" />}
      label="Multiple selection"
      ariaLabel="Multiple selection"
      checked={Boolean(state.inputNode?.multiple)}
      onToggle={actions.toggleMultiple}
    />
  );
};

// Per-option auto label style (Figma node 25472-18146): single-select Off / Letters / Numbers.
const OPTION_LABEL_CHOICES: { value: OptionLabelStyle; label: string }[] = [
  { value: "none", label: "Off" },
  { value: "letters", label: "Letters" },
  { value: "numbers", label: "Numbers" },
];

const OptionLabels = () => (
  <SubmenuRow icon={<LabelsIcon className="text-gray-800" />} label="Labels" view="labels" />
);

const OptionLabelsPanel = () => {
  const { state, actions } = useBlockMenu();
  // Mirror the editor's default: multiChoice shows letters until changed, others none.
  const current: OptionLabelStyle =
    state.inputNode?.optionLabel ??
    (state.inputNode?.variant === "multiChoice" ? "letters" : "none");
  return (
    <div className="p-1">
      {OPTION_LABEL_CHOICES.map((choice) => (
        <DropdownMenuItem
          key={choice.value}
          closeOnClick={false}
          className="text-gray-800"
          onClick={() => actions.setOptionLabel(choice.value)}
        >
          <span className="min-w-0 flex-1 text-left">{choice.label}</span>
          {current === choice.value && <CheckIcon className="size-4 shrink-0 text-gray-800" />}
        </DropdownMenuItem>
      ))}
    </div>
  );
};

// Toggles per-option image slots for the whole group; each option then uploads its own image inline.
const OptionImage = () => {
  const { state, actions } = useBlockMenu();
  return (
    <SwitchRow
      icon={<PhotoIcon className="text-gray-800" />}
      label="Image"
      ariaLabel="Image"
      checked={state.inputNode?.showImage === true}
      onToggle={actions.toggleOptionImage}
    />
  );
};

// File-upload "Selection limit" submenu (Figma node 25633-11549): max file size + max file count.
const FileSelectionLimit = () => (
  <SubmenuRow
    icon={<SelectionLimitIcon className="text-gray-800" />}
    label="Selection limit"
    view="file-selection-limit"
  />
);

const FileSelectionLimitPanel = () => {
  const { state, actions } = useBlockMenu();
  const { inputNode } = state;
  return (
    <PanelBody>
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
    </PanelBody>
  );
};

// File-upload "Allowed files" submenu (Figma node 25633-11852): a categorized extension allow-list.
// Empty selection ⇒ every extension is implicitly allowed (and shown active), so toggling narrows
// down. Each category's "All" row flips the whole group.
const AllowedFiles = () => (
  <SubmenuRow
    icon={<FileIcon className="size-4 text-gray-800" />}
    label="Allowed files"
    view="allowed-files"
  />
);

const AllowedFilesPanel = () => {
  const { state, actions } = useBlockMenu();
  const explicit = (state.inputNode?.allowedFileExtensions ?? []).filter((e) => e.startsWith("."));
  // Unset ⇒ the image-only default (mirrors resolveAllowedExtensions).
  const selected = explicit.length > 0 ? explicit : DEFAULT_FILE_UPLOAD_EXTENSIONS;
  const isActive = (ext: string) => selected.includes(ext);
  const baseline = () => selected;

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
    <div className="max-h-[340px] overflow-y-auto overscroll-contain p-1">
      {FILE_CATEGORIES.map((category) => {
        const exts = category.extensions.map((e) => e.ext);
        const allCategoryActive = exts.every((e) => isActive(e));
        return (
          <React.Fragment key={category.id}>
            {/* Header doubles as the group toggle — ticked when every extension is allowed. */}
            <DropdownMenuItem
              closeOnClick={false}
              className="mt-1 text-[12px] text-muted-foreground first:mt-0"
              onClick={() => toggleCategory(exts)}
            >
              <span className="min-w-0 flex-1 text-left">{category.label}</span>
              {allCategoryActive && <CheckIcon className="size-4 shrink-0 text-muted-foreground" />}
            </DropdownMenuItem>
            {category.extensions.map((e) => (
              <DropdownMenuItem
                key={`${category.id}${e.ext}`}
                closeOnClick={false}
                className="text-gray-800"
                onClick={() => toggleExtension(e.ext)}
              >
                <span className="min-w-0 flex-1 text-left">{e.ext}</span>
                {isActive(e.ext) && <CheckIcon className="size-4 shrink-0 text-gray-800" />}
              </DropdownMenuItem>
            ))}
          </React.Fragment>
        );
      })}
    </div>
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
    // closeOnClick={false}: the popup stays open and morphs into the bulk-insert panel.
    <DropdownMenuItem
      closeOnClick={false}
      className="text-gray-800"
      onClick={actions.openBulkInsert}
    >
      <BulkInsertIcon />
      <span className="flex-1 text-left">Bulk insert options</span>
      <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
      {/* Chevron marks the morph into the inline bulk-insert panel, matching the other submenu rows. */}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </DropdownMenuItem>
  );
};

// Inline "Add Options" panel — the menu popup morphs into this view (no separate dialog).
// Paste one option per line; Save splices them into the option group.
const BulkInsertPanel = () => {
  const { actions } = useBlockMenu();
  const [value, setValue] = React.useState("");
  const canSave = value.trim().length > 0;
  const save = () => {
    if (canSave) actions.submitBulkInsert(value);
  };

  return (
    <div className="flex flex-col gap-2 p-1">
      <p className="text-[12px] leading-normal text-muted-foreground">
        Write or paste your options below, one per line.
      </p>
      <Textarea
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        // Stop the menu's typeahead/arrow-nav from swallowing keys; Escape backs out to the
        // menu view; ⌘/Ctrl+Enter saves; plain Enter must add a new line (one option per line).
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            actions.setView(null);
            return;
          }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            save();
          }
        }}
        onKeyUp={stopKeyEventPropagation}
        onClick={stopMouseEventPropagation}
        onPointerDown={stopMouseEventPropagation}
        placeholder="Type each options on a new line"
        className="h-[140px] resize-none rounded-[10px] bg-muted shadow-none focus-visible:ring-0"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!canSave}>
          Save
        </Button>
      </div>
    </div>
  );
};

// `children` are rendered right after "Add conditional logic" — option menus slot the
// "Bulk insert options" action in there to match Figma's ordering.
const MenuActions = ({ children }: { children?: React.ReactNode }) => {
  const { state, actions } = useBlockMenu();

  return (
    <>
      {/* Repeatable sits at the top of the shared actions, just below the essentials divider —
          self-hides for non-scalar fields, so it shows wherever it applies. */}
      <RepeatableToggle />
      <DropdownMenuItem className="text-gray-800" onClick={actions.addLogic}>
        <ConditionalLogicIcon />
        <span className="flex-1 text-left">Add conditional logic</span>
        <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
      </DropdownMenuItem>
      {children}
      <DropdownMenuItem className="text-gray-800" onClick={actions.duplicateBlock}>
        <DuplicateIcon />
        <span className="flex-1 text-left">Duplicate</span>
        <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem className="text-gray-800" onClick={actions.hide}>
        <HideIcon />
        <span className="flex-1 text-left">Hide</span>
        <DropdownMenuShortcut>⌘H</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem className="text-gray-800" onClick={actions.deleteBlock}>
        <DeleteIcon />
        <span className="flex-1 text-left">Delete</span>
        <DropdownMenuShortcut>Del</DropdownMenuShortcut>
      </DropdownMenuItem>

      {state.canTurnInto && <TurnInto />}
    </>
  );
};

const TurnInto = () => <SubmenuRow icon={<TurnIntoIcon />} label="Turn into" view="turn-into" />;

const TURN_INTO_CHOICES: { type: string; label: string }[] = [
  { type: KEYS.p, label: "Paragraph" },
  { type: "formLabel", label: "Label" },
  { type: KEYS.h1, label: "Heading 1" },
  { type: KEYS.h2, label: "Heading 2" },
  { type: KEYS.h3, label: "Heading 3" },
  { type: KEYS.blockquote, label: "Blockquote" },
];

const TurnIntoPanel = () => {
  const { actions } = useBlockMenu();
  return (
    <div className="p-1">
      {TURN_INTO_CHOICES.map((choice) => (
        <DropdownMenuItem key={choice.type} onClick={() => actions.turnInto(choice.type)}>
          {choice.label}
        </DropdownMenuItem>
      ))}
    </div>
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
      icon={<ClockLineIcon className="text-gray-800" />}
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
      icon={<DecimalsArrowRightIcon className="size-4 text-gray-800" />}
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

// Linear scale "Scale" panel (Figma 25634-17867): dual-handle slider sets the scale's
// Start/End within the allowed bounds; the end labels show those bounds (-10 … 10).
const ScaleRange = () => (
  <SubmenuRow icon={<IconLinearScale className="text-gray-800" />} label="Scale" view="scale" />
);

const ScaleRangePanel = () => {
  const { state, actions } = useBlockMenu();
  const nodeMin = state.inputNode?.scaleMin ?? LINEAR_SCALE_DEFAULTS.min;
  const nodeMax = state.inputNode?.scaleMax ?? LINEAR_SCALE_DEFAULTS.max;
  // Drive the thumbs from local state so they track the pointer synchronously — routing every
  // drag tick through the Slate editor lags a *controlled* slider and pins the thumb. Persist
  // once on release; resync if the selected field (and thus the node values) changes.
  const [range, setRange] = React.useState<[number, number]>([nodeMin, nodeMax]);
  React.useEffect(() => {
    setRange([nodeMin, nodeMax]);
  }, [nodeMin, nodeMax]);
  return (
    <PanelBody>
      <div className="flex items-center justify-between text-[14px] font-medium tracking-[0.21px] text-foreground">
        <span>Start</span>
        <span>End</span>
      </div>
      {/* Stop propagation so dragging the slider doesn't dismiss the menu. */}
      <Slider
        aria-label="Scale range"
        min={LINEAR_SCALE_BOUNDS.min}
        max={LINEAR_SCALE_BOUNDS.max}
        value={range}
        onClick={stopMouseEventPropagation}
        onPointerDown={stopMouseEventPropagation}
        onValueChange={(value) => {
          const [a, b] = value as number[];
          // Keep at least one step of span so the scale always has ≥2 points.
          if (b > a) setRange([a, b]);
        }}
        onValueCommitted={(value) => {
          const [a, b] = value as number[];
          if (b > a) actions.setScaleRange(a, b);
        }}
      />
      {/* Figma (25634-17867): the end labels show the slider bounds (-10 … 10), not the selection. */}
      <div className="flex items-center justify-between text-[12px] tracking-[0.24px] text-gray-700">
        <span>{LINEAR_SCALE_BOUNDS.min}</span>
        <span>{LINEAR_SCALE_BOUNDS.max}</span>
      </div>
    </PanelBody>
  );
};

// base-ui's slider callbacks return a bare number for a single thumb but an array for multiple.
const readSliderValue = (value: number | readonly number[]): number =>
  Array.isArray(value) ? value[0] : (value as number);

// Linear scale "Scale step" panel (Figma 25644-10393): single slider + value box for the
// increment between points.
const ScaleStep = () => (
  <SubmenuRow
    icon={<HashIcon className="text-gray-800" strokeWidth={1} />}
    label="Scale step"
    view="scale-step"
  />
);

const ScaleStepPanel = () => {
  const { state, actions } = useBlockMenu();
  // `??` only guards null/undefined — a corrupt NaN slips through and renders "NaN". Mirror
  // extractLinearScaleFields: any non-finite/non-positive value falls back to the default.
  const rawStep = state.inputNode?.scaleStep;
  const nodeStep =
    typeof rawStep === "number" && rawStep > 0 ? rawStep : LINEAR_SCALE_DEFAULTS.step;
  // Local state for smooth dragging (see ScaleRange); persist on release.
  const [step, setStep] = React.useState(nodeStep);
  // Draft holds in-progress typing (incl. empty / below-min) so we don't fight the user mid-edit.
  const [draft, setDraft] = React.useState<string | null>(null);
  React.useEffect(() => {
    setStep(nodeStep);
  }, [nodeStep]);

  // Clamp to [stepMin, stepMax] and persist. Typed values hard-cap to stepMax (never > 10); min is
  // enforced here so an interim empty/0 can be typed and settles up on blur.
  const commitStep = (n: number) => {
    const clamped = Math.max(LINEAR_SCALE_BOUNDS.stepMin, Math.min(LINEAR_SCALE_BOUNDS.stepMax, n));
    setStep(clamped);
    actions.setScaleStep(clamped);
    setDraft(null);
  };

  const display = draft ?? String(step);

  return (
    <PanelBody>
      <div className="flex items-center gap-2.5">
        {/* Stop propagation so dragging the slider doesn't dismiss the menu. */}
        <Slider
          aria-label="Scale step"
          className="flex-1"
          min={LINEAR_SCALE_BOUNDS.stepMin}
          max={LINEAR_SCALE_BOUNDS.stepMax}
          value={[step]}
          onClick={stopMouseEventPropagation}
          onPointerDown={stopMouseEventPropagation}
          // base-ui hands back a bare number for a single-thumb slider (collision resolver treats
          // length-1 as non-range) but an array elsewhere — normalize both.
          onValueChange={(value) => {
            setDraft(null);
            setStep(readSliderValue(value));
          }}
          onValueCommitted={(value) => actions.setScaleStep(readSliderValue(value))}
        />
        <input
          type="number"
          aria-label="Scale step value"
          min={LINEAR_SCALE_BOUNDS.stepMin}
          max={LINEAR_SCALE_BOUNDS.stepMax}
          value={display}
          onClick={stopMouseEventPropagation}
          onPointerDown={stopMouseEventPropagation}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            if (raw === "") {
              setDraft("");
              return;
            }
            // Hard cap to stepMax so the box can never show a number greater than 10.
            const n = Math.min(LINEAR_SCALE_BOUNDS.stepMax, Number.parseInt(raw, 10));
            if (n >= LINEAR_SCALE_BOUNDS.stepMin) commitStep(n);
            else setDraft(String(n));
          }}
          onBlur={() => {
            const n = Number.parseInt(draft ?? String(step), 10);
            commitStep(Number.isNaN(n) ? LINEAR_SCALE_BOUNDS.stepMin : n);
          }}
          onKeyDown={(e) => {
            // Stop the menu from swallowing keystrokes (typeahead nav) so the box is typeable.
            stopKeyEventPropagation(e);
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-12 [appearance:textfield] rounded-lg bg-(--color-gray-alpha-100) px-2 py-1.5 text-center text-[14px] font-medium text-foreground outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    </PanelBody>
  );
};

// Linear scale "Add Anchor" (Figma 25634-16937 / 26153-13445): Left/Center/Right labels
// rendered under the scale tiles (e.g. Bad … Good).
const AddAnchor = () => (
  <SubmenuRow icon={<ScaleAnchorIcon />} label="Scale Anchor" view="scale-anchor" />
);

const ANCHOR_ROWS = [
  { key: "anchorLeft", label: "Left" },
  { key: "anchorCenter", label: "Center" },
  { key: "anchorRight", label: "Right" },
] as const;

const ScaleAnchorPanel = () => {
  const { state, actions } = useBlockMenu();
  return (
    <PanelBody>
      {ANCHOR_ROWS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2.5">
          <span className="w-[60px] shrink-0 text-[14px] text-foreground">{label}</span>
          <Input
            value={state.inputNode?.[key] ?? ""}
            onChange={(e) => actions.setAnchorLabel(key, e.target.value)}
            onKeyDown={stopKeyEventPropagation}
            placeholder="Add a label"
            aria-label={`${label} anchor label`}
            className="h-7 flex-1 rounded-lg border-none bg-(--color-gray-alpha-100) px-2 text-[13px] shadow-none"
          />
        </div>
      ))}
    </PanelBody>
  );
};

const LinearScaleFieldMenu = () => (
  <>
    <RequiredToggle />
    <ScaleRange />
    <ScaleStep />
    <MenuDivider />
    <AddAnchor />
    <MenuActions />
  </>
);

// Matrix (Figma node 25646-14665): Required + Shuffle (randomizes rows) + Multiple selection.
const MatrixFieldMenu = () => (
  <>
    <RequiredToggle />
    <ShuffleOptions />
    <MultipleSelection />
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
    <ShowAsDropdown />
    <SelectionLimit />
    <OptionLabels />
    <OptionImage />
    <MenuDivider />
    <MenuActions>
      <BulkInsertOptions />
    </MenuActions>
  </>
);

const MultiChoiceFieldMenu = () => (
  <>
    <RequiredToggle />
    <ShuffleOptions />
    <ShowAsDropdown />
    <SelectionLimit />
    <OptionLabels />
    <OptionImage />
    <MenuDivider />
    <MenuActions>
      <BulkInsertOptions />
    </MenuActions>
  </>
);

// Ranking (Figma 25650-16106): Required + Shuffle + Image, then actions incl. Bulk insert.
const RankingFieldMenu = () => (
  <>
    <RequiredToggle />
    <ShuffleOptions />
    <OptionImage />
    <MenuDivider />
    <MenuActions>
      <BulkInsertOptions />
    </MenuActions>
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

// Rating "Stars count" panel (Figma 25647-15073): a stepper bounded to 1…RATING_MAX_STARS.
const StarsCount = () => (
  <SubmenuRow
    icon={<IconRating className="text-gray-800" />}
    label="Stars count"
    view="stars-count"
  />
);

const StarsCountPanel = () => {
  const { state, actions } = useBlockMenu();
  return (
    <PanelBody>
      <StepperRow
        label="Stars"
        ariaLabel="Number of stars"
        value={state.inputNode?.starCount}
        onChange={actions.updateStarCount}
        min={1}
        max={RATING_MAX_STARS}
        defaultHint={RATING_DEFAULTS.starCount}
      />
    </PanelBody>
  );
};

// Rating (Figma 25647-15073): required + a star-count stepper.
const RatingFieldMenu = () => (
  <>
    <RequiredToggle />
    <StarsCount />
    <MenuDivider />
    <MenuActions />
  </>
);

// Inline subview registry — SubmenuRow triggers reference these ids; BlockMenu renders the
// active panel in place of the menu (PanelHeader + Panel), morphing the popup between them.
const INLINE_PANELS: Record<string, { label: string; width?: string; Panel: React.FC }> = {
  "character-limit": { label: "Character limit", Panel: CharacterLimitPanel },
  "value-range": { label: "Value range", Panel: ValueRangePanel },
  "selection-limit": { label: "Selection limit", Panel: SelectionLimitPanel },
  "file-selection-limit": { label: "Selection limit", Panel: FileSelectionLimitPanel },
  "allowed-files": { label: "Allowed files", Panel: AllowedFilesPanel },
  "default-country-code": { label: "Allowed countries", Panel: DefaultCountryCodePanel },
  "number-format": { label: "Format", Panel: NumberFormatPanel },
  labels: { label: "Labels", Panel: OptionLabelsPanel },
  scale: { label: "Scale", Panel: ScaleRangePanel },
  "scale-step": { label: "Scale step", Panel: ScaleStepPanel },
  "scale-anchor": { label: "Scale Anchor", Panel: ScaleAnchorPanel },
  "stars-count": { label: "Stars count", Panel: StarsCountPanel },
  "turn-into": { label: "Turn into", Panel: TurnIntoPanel },
  "bulk-insert": { label: "Add options", Panel: BulkInsertPanel },
};

const FIELD_MENU_VARIANTS: Record<BlockFieldType, React.FC> = {
  textLike: TextFieldMenu,
  formEmail: EmailFieldMenu,
  formPhone: PhoneFieldMenu,
  formDate: ScalarFieldMenu,
  formTime: TimeFieldMenu,
  formNumber: NumberFieldMenu,
  formFileUpload: FileFieldMenu,
  formLinearScale: LinearScaleFieldMenu,
  formMatrix: MatrixFieldMenu,
  optionCheckbox: CheckboxFieldMenu,
  optionMultiChoice: MultiChoiceFieldMenu,
  optionRanking: RankingFieldMenu,
  formRating: RatingFieldMenu,
  formSignature: ScalarFieldMenu,
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
  allowedCountries?: string[];
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
  showAsDropdown?: boolean;
  allowOther?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleStep?: number;
  anchorLeft?: string;
  anchorCenter?: string;
  anchorRight?: string;
  starCount?: number;
  multiple?: boolean;
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
