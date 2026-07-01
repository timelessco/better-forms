import { useCallback } from "react";

import type { Path, TElement } from "platejs";
import { useEditorRef, useEditorSelector } from "platejs/react";

type ElementWithId = TElement & { id?: string; required?: boolean };

import { useResolvedTheme } from "@/components/theme-provider";
import { useEditorTheme } from "@/contexts/editor-theme-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FORM_INPUT_NODE_TYPES } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";

const RequiredBadge = ({
  required,
  onToggle,
  className,
}: {
  required: boolean;
  onToggle: (e: React.MouseEvent) => void;
  className?: string;
}) => {
  // Drive dark/light from the FORM's mode, not Tailwind `dark:` — inside a dark
  // editor a `dark:` variant inherits the app's <html.dark> and would render dark
  // even on a light form. Fall back to app theme when the form has no customization.
  const appTheme = useResolvedTheme();
  const formMode = useEditorTheme().customization?.mode;
  const isDark = (formMode ?? appTheme) === "dark";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-label={required ? "Required field" : "Mark as required"}
            // Figma node 25242:986 — asterisk on a soft red disc. Required uses the
            // exact iOS red #ff3b30 (brighter than the theme --destructive #cd2b31)
            // at 12% bg / full-strength glyph; rounded-[8px] on a 16px box = circle.
            // Unset state is a muted grey disc as the "mark as required" affordance.
            className={cn(
              "absolute z-10 flex size-4 cursor-pointer items-center justify-center rounded-[8px] transition-colors",
              required
                ? "bg-[#ff3b30]/12 text-[#ff3b30] hover:bg-[#ff3b30]/20"
                : isDark
                  ? "bg-neutral-700 text-neutral-500 hover:bg-neutral-600"
                  : "bg-neutral-200 text-neutral-400 hover:bg-neutral-300",
              className,
            )}
            contentEditable={false}
            data-bf-drag-ignore="true"
            // Keep the editor's selection on click: mousedown fires first and would collapse the
            // Slate DOM selection (often to the doc start), so the subsequent setNodes triggers
            // scrollSelectionIntoView → the page jumps to the top. preventDefault stops that.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggle}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="13"
              viewBox="0 0 16 16"
              width="13"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.39 5.69L12.79 6.93L9.02 8.22L11.47 11.53L10.42 12.34L7.95 8.92L5.58 12.31L4.53 11.5L6.9 8.22L3.16 6.95L3.59 5.69L7.28 7.01V3.02H8.65V6.98L12.39 5.69Z"
                fill="currentColor"
              />
            </svg>
          </button>
        }
      />
      <TooltipContent side="right">{required ? "Required" : "Mark as required"}</TooltipContent>
    </Tooltip>
  );
};

type StandaloneInputBadgeProps = {
  required: boolean;
  /** Prefer `element` — toggle resolves a fresh path at click time, avoiding the stale-path bug. */
  element?: TElement;
  /** Fallback for callers without the element. */
  path?: Path;
  /**
   * Standalone input (no label) that still wants an inline badge — only the agreement-style
   * checkbox option item opts in. Labeled inputs render the badge on formLabel via
   * LabelRequiredBadge, avoiding the layout gap from an absolute badge under a reordered label.
   */
  showWithoutLabel?: boolean;
};

export const RequiredBadgeButton = ({
  required,
  element,
  path,
  showWithoutLabel = false,
}: StandaloneInputBadgeProps) => {
  const editor = useEditorRef();

  // Resolve path at click time. slate-react memoizes by identity, so props.path (useNodePath)
  // goes stale on reorder/insert/merge and the toggle would write `required` to the wrong block.
  // Prefer id-match (stable across reorders), then fresh findPath, then prop path.
  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (element) {
        const id = (element as ElementWithId).id;
        if (id) {
          editor.tf.setNodes({ required: !required }, { at: [], match: { id } });
          return;
        }
        const fresh = editor.api.findPath(element);
        if (fresh) {
          editor.tf.setNodes({ required: !required }, { at: fresh });
          return;
        }
      }
      if (path) {
        editor.tf.setNodes({ required: !required }, { at: path });
      }
    },
    [editor, required, element, path],
  );

  if (!showWithoutLabel) return null;

  return (
    <RequiredBadge
      className="top-1/2 right-2 -translate-y-1/2"
      onToggle={toggle}
      required={required}
    />
  );
};

/**
 * Required badge on a formLabel, state derived from the following input node (the source of
 * truth); label just reads + toggles its neighbor. Looks up index by element identity, not
 * props.path — useNodePath doesn't refresh on reorder and would target the wrong neighbor.
 */
export const LabelRequiredBadge = ({ labelElement }: { labelElement: TElement }) => {
  const editor = useEditorRef();

  const next = useEditorSelector(
    (ed) => {
      const children = ed.children as TElement[];
      const idx = children.indexOf(labelElement);
      if (idx < 0) return null;
      const sibling = children[idx + 1];
      if (!sibling || !FORM_INPUT_NODE_TYPES.has(sibling.type)) return null;
      const siblingId = (sibling as ElementWithId).id;
      return {
        required: Boolean((sibling as ElementWithId).required),
        siblingId,
        siblingPath: [idx + 1] as Path,
      };
    },
    [labelElement],
  );

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!next) return;
      if (next.siblingId) {
        editor.tf.setNodes({ required: !next.required }, { at: [], match: { id: next.siblingId } });
        return;
      }
      editor.tf.setNodes({ required: !next.required }, { at: next.siblingPath });
    },
    [editor, next],
  );

  if (!next) return null;

  return (
    <RequiredBadge
      className="top-1/2 right-0 -translate-y-1/2"
      onToggle={toggle}
      required={next.required}
    />
  );
};
