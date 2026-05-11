import type React from "react";
import { createContext, use, useCallback, useMemo, useState } from "react";

interface MinimalSidebarContextType {
  isPinned: boolean;
  isHovered: boolean;
  isVisible: boolean;
  isInboxOpen: boolean;
  togglePin: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  openInbox: () => void;
  closeInbox: () => void;
  toggleInbox: () => void;
}

const MinimalSidebarContext = createContext<MinimalSidebarContextType | undefined>(undefined);

export const MinimalSidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  const isVisible = isPinned || isHovered;

  const togglePin = useCallback(() => {
    setIsPinned((prev) => !prev);
  }, []);

  const onHoverStart = useCallback(() => {
    setIsHovered(true);
  }, []);

  const onHoverEnd = useCallback(() => {
    setIsHovered(false);
  }, []);

  const openInbox = useCallback(() => {
    setIsInboxOpen(true);
  }, []);

  const closeInbox = useCallback(() => {
    setIsInboxOpen(false);
  }, []);

  const toggleInbox = useCallback(() => {
    setIsInboxOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      isPinned,
      isHovered,
      isVisible,
      isInboxOpen,
      togglePin,
      onHoverStart,
      onHoverEnd,
      openInbox,
      closeInbox,
      toggleInbox,
    }),
    [
      isPinned,
      isHovered,
      isVisible,
      isInboxOpen,
      togglePin,
      onHoverStart,
      onHoverEnd,
      openInbox,
      closeInbox,
      toggleInbox,
    ],
  );

  return <MinimalSidebarContext.Provider value={value}>{children}</MinimalSidebarContext.Provider>;
};

export const useMinimalSidebar = () => {
  const context = use(MinimalSidebarContext);
  if (context === undefined) {
    throw new Error("useMinimalSidebar must be used within a MinimalSidebarProvider");
  }
  return context;
};
