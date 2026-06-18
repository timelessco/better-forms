import { useSyncExternalStore } from "react";

type SettingsTab = "account" | "notifications" | "members" | "billing" | "domains";
type SettingsState = { isOpen: boolean; activeTab: SettingsTab };
const listeners = new Set<() => void>();
let state: SettingsState = { isOpen: false, activeTab: "account" };
const SERVER_SNAPSHOT: SettingsState = { isOpen: false, activeTab: "account" };
const getServerSnapshot = () => SERVER_SNAPSHOT;

const emit = () => {
  listeners.forEach((l) => l());
};

const store = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  open: (tab: SettingsTab = "account") => {
    state = { isOpen: true, activeTab: tab };
    emit();
  },
  close: () => {
    state = { ...state, isOpen: false };
    emit();
  },
  setTab: (tab: SettingsTab) => {
    state = { ...state, activeTab: tab };
    emit();
  },
};

export type { SettingsTab };

export const useSettingsDialog = () => {
  const current = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);
  return {
    ...current,
    open: store.open,
    close: store.close,
    setTab: store.setTab,
  };
};

export const settingsDialogStore = store;
