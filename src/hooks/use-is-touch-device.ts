import { useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => {
  window.addEventListener("resize", callback, { passive: true });
  return () => window.removeEventListener("resize", callback);
};

const getSnapshot = () => "ontouchstart" in window || navigator.maxTouchPoints > 0;

const getServerSnapshot = () => false;

export const useIsTouchDevice = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
