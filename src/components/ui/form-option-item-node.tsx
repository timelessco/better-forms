import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { DndPlugin } from "@platejs/dnd";
import {
  PlateElement,
  useEditorRef,
  useEditorSelector,
  useEditorVersion,
  usePluginOption,
} from "platejs/react";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCheckIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  Loader2Icon,
  PhotoIcon,
} from "@/components/ui/icons";
import { useUploadFile } from "@/hooks/use-upload-file";
import { RequiredBadgeButton } from "@/components/ui/required-badge-button";
import { cn } from "@/lib/utils";

type OptionVariant = "checkbox" | "multiChoice" | "multiSelect" | "dropdown" | "ranking";

import { getMultiSelectColor, getOptionOrdinal } from "@/components/ui/form-option-item-constants";
import type { OptionLabelStyle } from "@/components/ui/form-option-item-constants";
import { useFormIsDark } from "@/hooks/use-form-theme";

// Letters/Numbers labels: an ordinal badge in a gray box (Figma nodes 25578:9710 / 25578:9688) —
// gray-100 fill, dark gray-900 text @ 12px Medium, flat (no shadow). Pin gray-100 (not the form's
// --form-input-bg, which themed forms remap to white → invisible badge).
const OptionLabelBadge = ({ text }: { text: string }) => (
  <span className="flex size-4 min-w-4 shrink-0 items-center justify-center rounded-[4px] bg-gray-100 px-0.5 text-[12px] font-medium text-gray-900">
    {text}
  </span>
);

const OptionIcon = ({
  variant,
  index,
  optionLabel,
}: {
  variant: OptionVariant;
  index: number;
  optionLabel: OptionLabelStyle;
}) => {
  const isDark = useFormIsDark();

  // Letters/Numbers override the native control with an ordinal badge, regardless of variant.
  if (optionLabel === "letters" || optionLabel === "numbers") {
    return <OptionLabelBadge text={getOptionOrdinal(optionLabel, index)} />;
  }

  switch (variant) {
    case "checkbox":
      return (
        <span className="flex size-4 shrink-0 items-center justify-center">
          <Checkbox disabled className="pointer-events-none after:hidden" />
        </span>
      );
    case "dropdown":
      return (
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          <ChevronDownIcon className="size-3" />
        </span>
      );
    case "ranking":
      // Reorder handle (Figma 25650-15798): up/down chevrons left of each rankable option.
      return (
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          <ChevronsUpDownIcon className="size-3.5" />
        </span>
      );
    case "multiChoice":
      // Labels "None" → the radio control (Figma node 25458:16773). size-4 to match the
      // letter/number badge column (and the published OptionRadioMark), so the label x stays
      // put when the label style changes between None and Letters/Numbers.
      return (
        <span className="flex size-4 shrink-0 rounded-full border border-input bg-card elevation-sm" />
      );
    case "multiSelect": {
      const color = getMultiSelectColor(index, isDark);
      return (
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[4px]",
            color.bg,
            color.text,
          )}
        >
          <CheckCheckIcon className="size-3" />
        </span>
      );
    }
    default:
      return null;
  }
};

// Per-option image (Figma 25755:3987): 144×60 rounded thumbnail below the label. Empty slot uploads
// on click; filled slot offers replace/remove on hover.
const OptionImageSlot = ({
  image,
  uploading,
  onPick,
  onRemove,
}: {
  image?: string;
  uploading: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const open = () => inputRef.current?.click();
  return (
    <div contentEditable={false} className="mt-1.5 pl-6 select-none">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      {image ? (
        <div className="group/img relative inline-block max-w-[280px] overflow-hidden rounded-lg">
          {/* Show the whole image as-is (natural aspect), just rounded + width-capped. */}
          <img src={image} alt="" className="block h-auto w-full" />
          <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/50 text-xs text-white group-hover/img:flex">
            <button
              type="button"
              onClick={open}
              className="rounded px-1.5 py-0.5 hover:bg-white/20"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="rounded px-1.5 py-0.5 hover:bg-white/20"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={uploading}
          className="flex h-[60px] w-[144px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-gray-100 text-xs text-muted-foreground hover:bg-gray-200 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <>
              <PhotoIcon className="size-4" />
              Add image
            </>
          )}
        </button>
      )}
    </div>
  );
};

export const FormOptionItemElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const variant = (element.variant as OptionVariant) || "checkbox";
  // Default preserves today's look: multiChoice → letter badges, all others → native control.
  const optionLabel =
    (element.optionLabel as OptionLabelStyle | undefined) ??
    (variant === "multiChoice" ? "letters" : "none");
  const editor = useEditorRef();
  const isDark = useFormIsDark();

  // Subscribe to every editor change so optionIndex tracks reorders. props.path (useNodePath)
  // doesn't update on reorder (slate-react memoizes by identity); look up index by node identity.
  const version = useEditorVersion();
  // Reactive focus index: useEditorVersion bumps on CONTENT only, not selection — read the focus via
  // useEditorSelector so moving the caret into an option re-renders and shows the "Add option" ghost.
  const focusIndex = useEditorSelector((ed) => ed.selection?.focus.path[0], []);

  const { optionIndex, isLastInGroup, isGroupFocused, isStandalone } = useMemo(() => {
    const nodes = editor.children as TElement[];
    const pathIdx = nodes.indexOf(element);
    if (pathIdx < 0)
      return {
        optionIndex: 0,
        isLastInGroup: false,
        isGroupFocused: false,
        isStandalone: false,
      };

    let idx = 0;
    for (let i = pathIdx - 1; i >= 0; i--) {
      if (nodes[i]?.type === "formOptionItem") idx++;
      else break;
    }

    const nextNode = nodes[pathIdx + 1];
    const isLast = !nextNode || nextNode.type !== "formOptionItem";

    // Standalone = no formLabel above AND no sibling option — decides whether to anchor the
    // required badge inline (grouped options' badge floats over the formLabel instead).
    const prevNode = pathIdx > 0 ? nodes[pathIdx - 1] : null;
    const standalone = idx === 0 && isLast && prevNode?.type !== "formLabel";

    let groupFocused = false;
    if (focusIndex !== undefined) {
      const focusNode = nodes[focusIndex];
      if (focusNode?.type === "formOptionItem") {
        let groupStart = pathIdx;
        while (groupStart > 0 && nodes[groupStart - 1]?.type === "formOptionItem") groupStart--;
        let groupEnd = pathIdx;
        while (groupEnd < nodes.length - 1 && nodes[groupEnd + 1]?.type === "formOptionItem")
          groupEnd++;
        groupFocused = focusIndex >= groupStart && focusIndex <= groupEnd;
      }
    }

    return {
      optionIndex: idx,
      isLastInGroup: isLast,
      isGroupFocused: groupFocused,
      isStandalone: standalone,
    };
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- version forces recompute on every editor change
  }, [editor, element, focusIndex, version]);

  // Suppress "Add option" ghost during any drag — Plate snapshots the option DOM for the
  // preview and would capture a visible ghost row alongside it.
  const draggingId = usePluginOption(DndPlugin, "draggingId") as string | string[] | undefined;
  const isAnyDragging = Array.isArray(draggingId) ? draggingId.length > 0 : Boolean(draggingId);
  const showGhost = isLastInGroup && isGroupFocused && !isAnyDragging;

  // When ghost is visible, push the next block down so it doesn't overlap. Add margin-top to the
  // block-draggable wrapper's next sibling, not this element — expanding here displaces the gutter.
  useLayoutEffect(() => {
    let domNode: HTMLElement | null = null;
    try {
      // eslint-disable-next-line typescript-eslint/no-explicit-any
      domNode = (editor.api as any).toDOMNode?.(element) ?? null;
    } catch {
      domNode = null;
    }
    if (!domNode) return;
    const blockWrapper = domNode.closest(".slate-blockWrapper");
    const draggableWrapper = blockWrapper?.parentElement;
    const nextSibling = draggableWrapper?.nextElementSibling as HTMLElement | null;
    if (!nextSibling) return;
    if (showGhost) {
      // Ghost is 30px tall, offset 4px below option (top-[calc(100%+4px)]),
      // plus another 4px gap after the ghost → total 38px margin.
      nextSibling.style.marginTop = "38px";
    } else {
      nextSibling.style.marginTop = "";
    }
    return () => {
      nextSibling.style.marginTop = "";
    };
  }, [editor, element, showGhost]);

  const colorStyle = variant === "multiSelect" ? getMultiSelectColor(optionIndex, isDark) : null;

  // Per-option image (group "Image" toggle sets showImage on every sibling). Upload via the shared
  // editor-media uploader, then store the URL on this option node.
  const showImage = element.showImage === true;
  const image = element.image as string | undefined;
  const { uploadFile, isUploading } = useUploadFile();
  const handleImagePick = useCallback(
    async (file: File) => {
      const uploaded = await uploadFile(file);
      if (!uploaded?.url) return;
      const idx = (editor.children as TElement[]).indexOf(element);
      if (idx >= 0) editor.tf.setNodes({ image: uploaded.url } as Partial<TElement>, { at: [idx] });
    },
    [uploadFile, editor, element],
  );
  const handleImageRemove = useCallback(() => {
    const idx = (editor.children as TElement[]).indexOf(element);
    if (idx >= 0) editor.tf.unsetNodes(["image"], { at: [idx] });
  }, [editor, element]);

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn(
        "relative w-full max-w-116 cursor-text rounded-md caret-current before:top-3.5 before:left-7.5 before:-translate-y-1/2 before:text-sm",
        colorStyle && cn(colorStyle.bg, colorStyle.text),
      )}
      element={element}
      {...rest}
    >
      <div className="flex h-[30px] items-center gap-2 pr-6 pl-0.5">
        <span contentEditable={false} className="pointer-events-none shrink-0 select-none">
          <OptionIcon variant={variant} index={optionIndex} optionLabel={optionLabel} />
        </span>
        <span className="min-w-0 flex-1 text-sm outline-none">{children}</span>
      </div>

      {showImage && (
        <OptionImageSlot
          image={image}
          uploading={isUploading}
          onPick={handleImagePick}
          onRemove={handleImageRemove}
        />
      )}

      {showGhost && (
        <div
          contentEditable={false}
          data-bf-drag-ignore="true"
          className="pointer-events-none absolute top-[calc(100%+4px)] right-0 left-0 flex h-[30px] items-center gap-2 pl-0.5 opacity-40 select-none"
        >
          <OptionIcon variant={variant} index={optionIndex + 1} optionLabel={optionLabel} />
          <span className="text-sm text-muted-foreground">Add option</span>
        </div>
      )}
      <RequiredBadgeButton
        required={Boolean(element.required)}
        path={props.path}
        showWithoutLabel={isStandalone}
      />
    </PlateElement>
  );
};
