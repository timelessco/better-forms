import { useSyncExternalStore } from "react";

type SettingsTab = "account" | "notifications" | "members" | "billing" | "domains";
// domainsDetailOpen: a domain's stacked detail screen supplies its own header, so the
// generic "Domain" DialogTitle is visually suppressed while it's open (Figma 26281-7612).
type SettingsState = { isOpen: boolean; activeTab: SettingsTab; domainsDetailOpen: boolean };
const listeners = new Set<() => void>();
let state: SettingsState = { isOpen: false, activeTab: "account", domainsDetailOpen: false };
const SERVER_SNAPSHOT: SettingsState = {
  isOpen: false,
  activeTab: "account",
  domainsDetailOpen: false,
};
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
    state = { isOpen: true, activeTab: tab, domainsDetailOpen: false };
    emit();
  },
  close: () => {
    state = { ...state, isOpen: false };
    emit();
  },
  setTab: (tab: SettingsTab) => {
    state = { ...state, activeTab: tab, domainsDetailOpen: false };
    emit();
  },
  setDomainsDetailOpen: (open: boolean) => {
    if (state.domainsDetailOpen === open) return;
    state = { ...state, domainsDetailOpen: open };
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
    setDomainsDetailOpen: store.setDomainsDetailOpen,
  };
};

export const settingsDialogStore = store;
