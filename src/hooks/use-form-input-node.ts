import type { TElement } from "platejs";
import { NodeApi } from "platejs";
import { useEditorSelector, useFocused } from "platejs/react";

export const useFormInputNode = (element: TElement) => {
  const focused = useFocused();
  const isSelected = useEditorSelector(
    (ed) => {
      if (!ed.selection) return false;
      const path = ed.api.findPath(element);
      if (!path) return false;
      const focusPath = ed.selection.focus.path;
      if (focusPath.length < path.length) return false;
      for (let i = 0; i < path.length; i++) {
        if (focusPath[i] !== path[i]) return false;
      }
      return true;
    },
    [element],
  );
  return { focused, isSelected };
};

/**
 * Returns the text of the block immediately preceding `element` (the field's
 * label block — `formLabel` / heading / paragraph). Subscribes via
 * `useEditorSelector` so the value updates live as the user edits the label,
 * and re-renders only when the derived string actually changes.
 *
 * Returns `""` when the field has no preceding block.
 */
export const useFieldLabelText = (element: TElement): string =>
  useEditorSelector(
    (ed) => {
      const path = ed.api.findPath(element);
      if (!path || path.length === 0 || path[0] === 0) return "";
      const prev = (ed.children as TElement[])[path[0] - 1];
      return prev ? NodeApi.string(prev).trim() : "";
    },
    [element],
  );
