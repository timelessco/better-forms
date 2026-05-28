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
    // Storage unavailable (private mode, quota, blocked).
  }
};

/** Stable per-visitor UUID in localStorage "bf_vid". SSR-safe (""); falls back
 * to in-module memoized UUID when localStorage unavailable. */
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

/** Per-tab-session UUID in sessionStorage "bf_sid". SSR-safe (""); falls back
 * to in-module memoized UUID when sessionStorage unavailable. */
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
