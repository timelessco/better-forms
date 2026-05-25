import { eq, useLiveQuery } from "@tanstack/react-db";
import { useCallback } from "react";
import { editorUICollection } from "@/collections/local/editor-ui";
import type { SettingsTab, ShareTab, SidebarType } from "@/collections/local/editor-ui";

export type { SettingsTab, SidebarType };
export type EmbedType = "standard" | "popup" | "fullpage";

const useEditorUIState = () => {
  const { data } = useLiveQuery(
    (q) => q.from({ state: editorUICollection }).where(({ state }) => eq(state.id, "editor-ui")),
    [],
  );
  return (
    data?.[0] ?? {
      activeSidebar: null,
      settingsTab: "settings" as const,
      shareTab: "share" as const,
      selectedVersionId: null,
      previewMode: false,
    }
  );
};

export const useEditorSidebar = () => {
  const state = useEditorUIState();

  const openSettings = useCallback((tab?: SettingsTab) => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.activeSidebar = "settings";
      draft.selectedVersionId = null;
      if (tab) draft.settingsTab = tab;
    });
  }, []);

  const openShare = useCallback((tab?: ShareTab) => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.activeSidebar = "share";
      draft.selectedVersionId = null;
      if (tab) draft.shareTab = tab;
    });
  }, []);

  const openVersionHistory = useCallback((versionId?: string) => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.activeSidebar = "history";
      if (versionId) draft.selectedVersionId = versionId;
    });
  }, []);

  const openCustomize = useCallback(() => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.activeSidebar = "customize";
      draft.selectedVersionId = null;
    });
  }, []);

  const openAbout = useCallback(() => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.activeSidebar = "about";
      draft.selectedVersionId = null;
    });
  }, []);

  const closeSidebar = useCallback(() => {
    editorUICollection.update("editor-ui", (draft) => {
      const wasShareOpen = draft.activeSidebar === "share";
      draft.activeSidebar = null;
      draft.selectedVersionId = null;
      if (wasShareOpen) {
        draft.previewMode = false;
      }
    });
  }, []);

  const resetSidebar = useCallback(() => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.activeSidebar = null;
      draft.settingsTab = "settings";
      draft.shareTab = "share";
      draft.selectedVersionId = null;
      draft.previewMode = false;
    });
  }, []);

  const toggleSidebar = useCallback((sidebar: SidebarType, tab?: SettingsTab | ShareTab) => {
    editorUICollection.update("editor-ui", (draft) => {
      const isAlreadyOpen = draft.activeSidebar === sidebar;
      const isSwitchingTab =
        isAlreadyOpen &&
        tab &&
        ((sidebar === "settings" && draft.settingsTab !== tab) ||
          (sidebar === "share" && draft.shareTab !== tab));

      const nextSidebar = isAlreadyOpen && !isSwitchingTab ? null : sidebar;

      draft.activeSidebar = nextSidebar;

      if (nextSidebar && tab) {
        if (nextSidebar === "settings") {
          draft.settingsTab = tab as SettingsTab;
        } else if (nextSidebar === "share") {
          draft.shareTab = tab as ShareTab;
        }
      }

      // When toggling share OFF, exit preview mode
      if (sidebar === "share" && isAlreadyOpen && !isSwitchingTab) {
        draft.previewMode = false;
      }

      // Clear version selection when leaving the history sidebar
      if (nextSidebar !== "history") {
        draft.selectedVersionId = null;
      }
    });
  }, []);

  const selectVersion = useCallback((versionId: string | null) => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.selectedVersionId = versionId;
    });
  }, []);

  const exitVersionView = useCallback(() => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.selectedVersionId = null;
    });
  }, []);

  const enterPreview = useCallback(() => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.previewMode = true;
    });
  }, []);

  const exitPreview = useCallback(() => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.previewMode = false;
    });
  }, []);

  const togglePreview = useCallback(() => {
    editorUICollection.update("editor-ui", (draft) => {
      draft.previewMode = !draft.previewMode;
    });
  }, []);

  return {
    activeSidebar: state.activeSidebar,
    settingsTab: state.settingsTab,
    shareTab: state.shareTab,
    selectedVersionId: state.selectedVersionId,
    previewMode: state.previewMode,
    isOpen: state.activeSidebar !== null,
    openSettings,
    openShare,
    openVersionHistory,
    openCustomize,
    openAbout,
    closeSidebar,
    resetSidebar,
    toggleSidebar,
    selectVersion,
    exitVersionView,
    enterPreview,
    exitPreview,
    togglePreview,
  };
};
