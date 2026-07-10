import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useCallback } from "react";
import { safeStorage } from "@/lib/safe-storage";

const STORAGE_KEY_PREFIX = "betterforms_";
const DEBOUNCE_MS = 500;

export const useFormPersistence = (formId: string, enabled: boolean) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${formId}`;

  const loadSavedData = useCallback((): Record<string, unknown> | null => {
    if (!enabled) return null;

    const parsed = safeStorage.getJson<unknown>(storageKey);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  }, [storageKey, enabled]);

  const saveData = useDebouncedCallback(
    (data: Record<string, unknown>) => {
      safeStorage.setJson(storageKey, data);
    },
    { wait: DEBOUNCE_MS, enabled },
  );

  const clearSavedData = useCallback(() => {
    safeStorage.remove(storageKey);
  }, [storageKey]);

  return { loadSavedData, saveData, clearSavedData };
};
