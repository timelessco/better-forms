import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useCallback } from "react";

const STORAGE_KEY_PREFIX = "betterforms_";
const DEBOUNCE_MS = 500;

export const useFormPersistence = (formId: string, enabled: boolean) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${formId}`;

  const loadSavedData = useCallback((): Record<string, unknown> | null => {
    if (!enabled) return null;
    if (typeof window === "undefined") return null;

    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return null;
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {}
      return null;
    } catch {
      return null;
    }
  }, [storageKey, enabled]);

  const saveData = useDebouncedCallback(
    (data: Record<string, unknown>) => {
      if (typeof window === "undefined") return;

      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        // Storage quota exceeded or unavailable - silently fail
      }
    },
    { wait: DEBOUNCE_MS, enabled },
  );

  const clearSavedData = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Silently fail
    }
  }, [storageKey]);

  return { loadSavedData, saveData, clearSavedData };
};
