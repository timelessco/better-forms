import type React from "react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

interface EditorHeaderVisibilityContextType {
  enabled: boolean;
  visible: boolean;
  reportTyping: () => void;
  reportPointerActivity: () => void;
  resetVisibility: () => void;
}

const HIDE_DELAY_MS = 0;

const EditorHeaderVisibilityContext = createContext<EditorHeaderVisibilityContextType | undefined>(
  undefined,
);

export const EditorHeaderVisibilityProvider = ({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) => {
  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (!hideTimerRef.current) return;
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);

  const resetVisibility = useCallback(() => {
    clearHideTimer();
    setVisible(true);
  }, [clearHideTimer]);

  const reportTyping = useCallback(() => {
    if (!enabled) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
  }, [enabled, clearHideTimer]);

  const reportPointerActivity = useCallback(() => {
    if (!enabled) return;
    clearHideTimer();
    setVisible(true);
  }, [enabled, clearHideTimer]);

  // When disabled, visibility is always true (derived, not via effect)
  const effectiveVisible = enabled ? visible : true;

  const onMouseMoveEvent = useEffectEvent(() => {
    reportPointerActivity();
  });

  useEffect(() => {
    if (!enabled || visible) return;
    const onMouseMove = () => {
      onMouseMoveEvent();
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [enabled, visible]);

  useMountEffect(() => () => {
    clearHideTimer();
  });

  const value = useMemo(
    () => ({
      enabled,
      visible: effectiveVisible,
      reportTyping,
      reportPointerActivity,
      resetVisibility,
    }),
    [enabled, effectiveVisible, reportTyping, reportPointerActivity, resetVisibility],
  );

  return (
    <EditorHeaderVisibilityContext.Provider value={value}>
      {children}
    </EditorHeaderVisibilityContext.Provider>
  );
};

export const useEditorHeaderVisibility = () => {
  const context = use(EditorHeaderVisibilityContext);
  if (!context) {
    throw new Error(
      "useEditorHeaderVisibility must be used within a EditorHeaderVisibilityProvider",
    );
  }
  return context;
};

export const useEditorHeaderVisibilitySafe = () => use(EditorHeaderVisibilityContext);
