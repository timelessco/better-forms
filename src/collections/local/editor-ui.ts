import { createCollection, localOnlyCollectionOptions } from "@tanstack/react-db";

export type SidebarType = "settings" | "share" | "history" | "customize" | "about" | null;
export type SettingsTab = "integrations" | "settings";
export type ShareTab = "share" | "summary";

export type EditorUIState = {
  id: "editor-ui";
  activeSidebar: SidebarType;
  settingsTab: SettingsTab;
  shareTab: ShareTab;
  selectedVersionId: string | null;
  previewMode: boolean;
  // Transient: which color mode the Customize sidebar is editing/previewing. null = follow the
  // form's effective theme. Scopes the editor preview only — never touches the app theme.
  editorColorMode: "light" | "dark" | null;
};

const initialState: EditorUIState = {
  id: "editor-ui",
  activeSidebar: null,
  settingsTab: "settings",
  shareTab: "share",
  selectedVersionId: null,
  previewMode: false,
  editorColorMode: null,
};

export const editorUICollection = createCollection(
  localOnlyCollectionOptions<EditorUIState>({
    id: "editor-ui-state",
    getKey: (item) => item.id,
    initialData: [initialState],
  }),
);
