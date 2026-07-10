// SSR-safe, throw-proof Web Storage access. Every call guards `typeof window`
// (SSR) and try/catch (private mode, quota, blocked storage) so callers never
// re-implement the same defensive boilerplate.

type StorageArea = "local" | "session";

const resolve = (area: StorageArea): Storage | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    return area === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return undefined;
  }
};

export const safeStorage = {
  get(key: string, area: StorageArea = "local"): string | null {
    try {
      return resolve(area)?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },

  set(key: string, value: string, area: StorageArea = "local"): void {
    try {
      resolve(area)?.setItem(key, value);
    } catch {
      // Storage unavailable (private mode, quota, blocked) — no-op.
    }
  },

  remove(key: string, area: StorageArea = "local"): void {
    try {
      resolve(area)?.removeItem(key);
    } catch {
      // Storage unavailable — no-op.
    }
  },

  getJson<T>(key: string, area: StorageArea = "local"): T | null {
    const raw = safeStorage.get(key, area);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  setJson(key: string, value: unknown, area: StorageArea = "local"): void {
    try {
      safeStorage.set(key, JSON.stringify(value), area);
    } catch {
      // Non-serializable value — no-op.
    }
  },
};
