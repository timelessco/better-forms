const VISITOR_KEY = "bf_vid";
const SESSION_KEY = "bf_sid";

let memoVisitor: string | null = null;
let memoSession: string | null = null;

const safeGet = (storage: Storage | undefined, key: string): string | null => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const safeSet = (storage: Storage | undefined, key: string, value: string): void => {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota, blocked) — swallow.
  }
};

/**
 * Returns a stable per-visitor UUID stored in localStorage under "bf_vid".
 * SSR-safe: returns "" when window is undefined.
 * Falls back to an in-module memoized UUID when localStorage is unavailable.
 */
export const getOrCreateVisitorHash = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  if (memoVisitor) {
    return memoVisitor;
  }
  const existing = safeGet(window.localStorage, VISITOR_KEY);
  if (existing) {
    memoVisitor = existing;
    return existing;
  }
  const fresh = crypto.randomUUID();
  safeSet(window.localStorage, VISITOR_KEY, fresh);
  memoVisitor = fresh;
  return fresh;
};

/**
 * Returns a per-tab-session UUID stored in sessionStorage under "bf_sid".
 * SSR-safe: returns "" when window is undefined.
 * Falls back to an in-module memoized UUID when sessionStorage is unavailable.
 */
export const getOrCreateSessionId = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  if (memoSession) {
    return memoSession;
  }
  const existing = safeGet(window.sessionStorage, SESSION_KEY);
  if (existing) {
    memoSession = existing;
    return existing;
  }
  const fresh = crypto.randomUUID();
  safeSet(window.sessionStorage, SESSION_KEY, fresh);
  memoSession = fresh;
  return fresh;
};
