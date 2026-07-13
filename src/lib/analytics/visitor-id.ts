import { safeStorage } from "@/lib/safe-storage";

const VISITOR_KEY = "bf_vid";
const SESSION_KEY = "bf_sid";

let memoVisitor: string | null = null;
let memoSession: string | null = null;

/** Stable per-visitor UUID in localStorage "bf_vid". SSR-safe (""); falls back
 * to in-module memoized UUID when localStorage unavailable. */
export const getOrCreateVisitorHash = (): string => {
  if (typeof window === "undefined") {
    return "";
  }
  if (memoVisitor) {
    return memoVisitor;
  }
  const existing = safeStorage.get(VISITOR_KEY);
  if (existing) {
    memoVisitor = existing;
    return existing;
  }
  const fresh = crypto.randomUUID();
  safeStorage.set(VISITOR_KEY, fresh);
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
  const existing = safeStorage.get(SESSION_KEY, "session");
  if (existing) {
    memoSession = existing;
    return existing;
  }
  const fresh = crypto.randomUUID();
  safeStorage.set(SESSION_KEY, fresh, "session");
  memoSession = fresh;
  return fresh;
};
