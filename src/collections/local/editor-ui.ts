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
};

const initialState: EditorUIState = {
  id: "editor-ui",
  activeSidebar: null,
  settingsTab: "settings",
  shareTab: "share",
  selectedVersionId: null,
  previewMode: false,
};

export const editorUICollection = createCollection(
  localOnlyCollectionOptions<EditorUIState>({
    id: "editor-ui-state",
    getKey: (item) => item.id,
    initialData: [initialState],
  }),
);
