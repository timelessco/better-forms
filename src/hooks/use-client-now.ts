import { useSyncExternalStore } from "react";

const REFRESH_MS = 60_000;

const listeners = new Set<() => void>();
let cachedNow = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

const tick = () => {
  cachedNow = Date.now();
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  // When the last subscriber unmounts the interval is cleared but cachedNow
  // retains its old value; refresh it here so a remount doesn't display a
  // stale relative-time label until the next 60s tick.
  if (listeners.size === 0) cachedNow = Date.now();
  listeners.add(listener);
  if (intervalId === null) intervalId = setInterval(tick, REFRESH_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
};

const getSnapshot = () => {
  if (cachedNow === 0) cachedNow = Date.now();
  return cachedNow;
};

const getServerSnapshot = () => 0;

/** SSR pass returns 0 so relative-time labels render as a placeholder until hydrate. */
export const useClientNow = (): number =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

/** Date-typed view of {@link useClientNow}; returns `null` on the SSR pass. */
export const useClientToday = (): Date | null => {
  const nowMs = useClientNow();
  return nowMs ? new Date(nowMs) : null;
};
