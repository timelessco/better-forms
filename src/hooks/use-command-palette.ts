import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let isOpen = false;

const store = {
  getSnapshot: () => isOpen,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setIsOpen: (value: boolean) => {
    isOpen = value;
    listeners.forEach((l) => {
      l();
    });
  },
  toggle: () => {
    isOpen = !isOpen;
    listeners.forEach((l) => {
      l();
    });
  },
};

export const useCommandPalette = () => {
  const isPaletteOpen = useSyncExternalStore(store.subscribe, store.getSnapshot, () => false);

  return {
    isOpen: isPaletteOpen,
    setIsOpen: store.setIsOpen,
    toggle: store.toggle,
  };
};
