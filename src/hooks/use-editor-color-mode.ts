import { eq, useLiveQuery } from "@tanstack/react-db";
import { useCallback } from "react";
import { editorUICollection } from "@/collections/local/editor-ui";

/**
 * Editor color-mode override — which mode the Customize sidebar is editing/previewing.
 * null = follow the form's effective theme. Scopes the form/editor preview ONLY; unlike the app
 * theme (useTheme/setTheme) it never toggles the `.dark` class on <html>, so the app chrome stays put.
 */
export const useEditorColorMode = () => {
  const { data } = useLiveQuery(
    (q) => q.from({ state: editorUICollection }).where(({ state }) => eq(state.id, "editor-ui")),
    [],
  );
  const editorColorMode = data?.[0]?.editorColorMode ?? null;

  const setEditorColorMode = useCallback((mode: "light" | "dark" | null) => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.editorColorMode = mode;
    });
  }, []);

  return { editorColorMode, setEditorColorMode };
};
