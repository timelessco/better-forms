import { PathApi } from "platejs";
import type { Path, TElement } from "platejs";
import { createPlatePlugin } from "platejs/react";
import { FormHeaderElement } from "@/components/ui/form-header-node";

export const FormHeaderPlugin = createPlatePlugin({
  key: "formHeader",
  node: {
    isElement: true,
    isVoid: true,
    isSelectable: false,
    component: FormHeaderElement,
  },
  handlers: {
    onKeyDown: ({ editor, event }) => {
      if (event.key !== "ArrowUp") return;

      const block = editor.api.block();
      if (!block) return;

      const [, path] = block;

      // Only act when cursor is in the first content block (right after header)
      if (path[0] !== 1) return;

      const selection = editor.selection;
      if (!selection || !editor.api.isCollapsed()) return;

      // eslint-disable-next-line typescript-eslint/no-explicit-any
      const edges = editor.api.edges(path) as any;
      const start = edges?.[0];
      if (
        !start ||
        !PathApi.equals(selection.anchor.path, start.path) ||
        selection.anchor.offset !== start.offset
      ) {
        return;
      }

      const titleTextarea = document.querySelector<HTMLTextAreaElement>(
        "[data-bf-header] textarea",
      );
      if (titleTextarea) {
        event.preventDefault();
        titleTextarea.focus();
        const len = titleTextarea.value.length;
        titleTextarea.setSelectionRange(len, len);
      }
    },
  },
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  extendEditor: ({ editor }: any) => {
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    const editorRef = editor;
    const { normalizeNode, deleteBackward, deleteForward, deleteFragment } = editorRef;

    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.normalizeNode = (entry: any) => {
      const path = entry[1];

      if (path.length === 0) {
        const children = editorRef.children as TElement[];

        // Ensure first child is formHeader
        if (children.length > 0 && children[0].type !== "formHeader") {
          const headerIndex = children.findIndex((n) => n.type === "formHeader");

          if (headerIndex !== -1) {
            editorRef.tf.moveNodes({
              at: [headerIndex],
              to: [0],
            });
            return;
          }
        }

        // Ensure at least one paragraph after header
        if (children.length === 1 && children[0].type === "formHeader") {
          editorRef.tf.insertNodes({ type: "p", children: [{ text: "" }] } as TElement, {
            at: [1],
          });
          return;
        }
      }

      normalizeNode(entry);
    };

    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.deleteBackward = (unit: any) => {
      const block = editorRef.api.block();
      const [node, path] = (block as [TElement, Path]) ?? [];

      if (node?.type === "formHeader") {
        return;
      }

      // Prevent deleting backwards INTO the header
      if (path && path[0] === 1) {
        const selection = editorRef.selection;
        if (selection && editorRef.api.isCollapsed()) {
          // eslint-disable-next-line typescript-eslint/no-explicit-any
          const edges = editorRef.api.edges(path);
          const start = edges?.[0];
          if (
            start &&
            PathApi.equals(selection.anchor.path, start.path) &&
            selection.anchor.offset === start.offset
          ) {
            return;
          }
        }
      }

      deleteBackward(unit);
    };

    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.deleteForward = (unit: any) => {
      const block = editorRef.api.block();
      const [node] = (block as [TElement, Path]) ?? [];

      if (node?.type === "formHeader") {
        return;
      }

      deleteForward(unit);
    };

    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.deleteFragment = (direction: any) => {
      const { selection } = editorRef;
      if (!selection) {
        deleteFragment(direction);
        return;
      }

      // eslint-disable-next-line typescript-eslint/no-explicit-any
      const edges = editorRef.api.edges(selection) ?? [];
      const start = edges[0];
      const end = edges[1];

      if (start?.path?.[0] === 0) {
        if (editorRef.children.length > 1) {
          editorRef.tf.delete({
            at: {
              // eslint-disable-next-line typescript-eslint/no-explicit-any
              anchor: editorRef.api.edges([1])[0],
              focus: end,
            },
          });

          if (editorRef.children.length === 1) {
            editorRef.tf.insertNodes({ type: "p", children: [{ text: "" }] } as TElement, {
              at: [1],
            });
            // eslint-disable-next-line typescript-eslint/no-explicit-any
            editorRef.tf.select(editorRef.api.edges([1])[0]);
          }
          return;
        }
        return;
      }

      deleteFragment(direction);
    };

    return editorRef;
  },
});

export const FormHeaderKit = [FormHeaderPlugin];
