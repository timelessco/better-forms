import { safeStorage } from "@/lib/safe-storage";
import { useSyncExternalStore } from "react";

// Recently-opened form ids, persisted to localStorage — no DB round-trip. Most-recent-first,
// deduped, capped. Recorded from the form-builder route loader (covers every open path), read
// reactively by the command palette via useSyncExternalStore.

const KEY = "reform:recent-forms";
const MAX = 12;
const EMPTY: readonly string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

const read = (): string[] => {
  if (typeof window === "undefined") return cache ?? (EMPTY as string[]);
  if (cache) return cache;
  const parsed = safeStorage.getJson<unknown>(KEY);
  cache = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  return cache;
};

const write = (next: string[]) => {
  cache = next; // in-memory cache still drives this session if storage write fails
  safeStorage.setJson(KEY, next);
  for (const notify of listeners) notify();
};

/** Record a form open: move it to the front, dedupe, cap. */
export const pushRecentForm = (formId: string): void => {
  if (!formId || typeof window === "undefined") return;
  const next = [formId, ...read().filter((id) => id !== formId)].slice(0, MAX);
  write(next);
};

const subscribe = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null; // re-read on next snapshot
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
};

const getServerSnapshot = (): string[] => EMPTY as string[];

/** Reactive list of recently-opened form ids (most-recent-first). */
export const useRecentFormIds = (): string[] =>
  useSyncExternalStore(subscribe, read, getServerSnapshot);
