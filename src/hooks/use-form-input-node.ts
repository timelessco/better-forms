import type { TElement } from "platejs";
import { NodeApi } from "platejs";
import { useEditorSelector } from "platejs/react";

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
