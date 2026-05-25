import { useCallback } from "react";
import { useEditorSidebar } from "./use-editor-sidebar";

export const useVersionHistorySidebar = () => {
  const {
    activeSidebar,
    toggleSidebar,
    openVersionHistory,
    closeSidebar,
    selectedVersionId,
    selectVersion,
    exitVersionView,
  } = useEditorSidebar();

  const isOpen = activeSidebar === "history";

  const isViewingVersion = selectedVersionId !== null;

  const handleSetIsOpen = useCallback(
    (open: boolean) => {
      if (open) {
        openVersionHistory();
      } else {
        exitVersionView();
        closeSidebar();
      }
    },
    [openVersionHistory, closeSidebar, exitVersionView],
  );

  return {
    isOpen,
    selectedVersionId,
    isViewingVersion,
    setIsOpen: handleSetIsOpen,
    selectVersion,
    exitVersionView,
    toggle: () => toggleSidebar("history"),
  };
};
