import { useCallback } from "react";

import type { Path, TElement } from "platejs";
import { useEditorRef, useEditorSelector } from "platejs/react";

type ElementWithId = TElement & { id?: string; required?: boolean };

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
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <button
          aria-label={required ? "Required field" : "Mark as required"}
          className={cn(
            "absolute z-10 flex size-4 cursor-pointer items-center justify-center rounded-[8px] transition-colors",
            required
              ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
              : "bg-neutral-200 text-neutral-400 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-600",
            className,
          )}
          contentEditable={false}
          data-bf-drag-ignore="true"
          onClick={onToggle}
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="10"
            viewBox="0 0 16 16"
            width="10"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.3892 5.68944L12.793 6.92754L9.02484 8.21946L11.4741 11.53L10.4244 12.3375L7.94824 8.91925L5.57971 12.3106L4.53002 11.5031L6.89855 8.21946L3.15735 6.95445L3.58799 5.68944L7.27536 7.00828V3.02484H8.64803V6.98137L12.3892 5.68944Z"
              fill="currentColor"
            />
          </svg>
        </button>
      }
    />
    <TooltipContent side="right">{required ? "Required" : "Mark as required"}</TooltipContent>
  </Tooltip>
);

type StandaloneInputBadgeProps = {
  required: boolean;
  /**
   * Prefer passing `element` — it lets the toggle resolve a fresh path at
   * click time, avoiding the stale-path bug below. `path` is supported as a
   * fallback for callers that don't have direct access to the element.
   */
  element?: TElement;
  path?: Path;
  /**
   * True when the caller has determined this input is standalone (no label
   * above) and still wants an inline badge — currently only the
   * agreement-style checkbox option item opts in. Otherwise the badge for a
   * labeled input is rendered on the `formLabel` itself via
   * `LabelRequiredBadge`, which avoids the layout gap that appeared when the
   * label was reordered above an input that carried its own absolute badge.
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

  // Resolve the path at click time when we have the element. `props.path`
  // (from useNodePath) doesn't update on sibling reorder because slate-react
  // memoizes elements by identity, so a closure-captured path can point at
  // the wrong block after a drag, insert-above, or normalize merge — the
  // toggle would then write `required` to whatever block currently sits at
  // the stale index. Prefer id-match (stable across reorders), fall back to
  // a fresh findPath, and only use the prop `path` if no element was given.
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
 * Renders the required badge on a `formLabel`, deriving its state from the
 * immediately-following input node. The input node remains the source of
 * truth for `required`; the label just reads + toggles its neighbor.
 *
 * Looks up the label's current index by element identity (not the captured
 * `props.path`) because slate-react's useNodePath doesn't refresh on sibling
 * reorder — a stale path would point the toggle at the wrong neighbor.
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
