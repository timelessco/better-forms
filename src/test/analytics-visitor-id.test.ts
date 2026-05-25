// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type VisitorIdModule = typeof import("@/lib/analytics/visitor-id");

const importFresh = async (): Promise<VisitorIdModule> => {
  vi.resetModules();
  return await import("@/lib/analytics/visitor-id");
};

describe("getOrCreateVisitorHash", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns a non-empty string when storage is available", async () => {
    const { getOrCreateVisitorHash } = await importFresh();
    const value = getOrCreateVisitorHash();
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("returns the same value across calls in the same tab", async () => {
    const { getOrCreateVisitorHash } = await importFresh();
    const first = getOrCreateVisitorHash();
    const second = getOrCreateVisitorHash();
    expect(first).toBe(second);
    expect(window.localStorage.getItem("bf_vid")).toBe(first);
  });

  it("generates a new value after localStorage is cleared and module is reset", async () => {
    const moduleA = await importFresh();
    const first = moduleA.getOrCreateVisitorHash();
    window.localStorage.clear();
    const moduleB = await importFresh();
    const next = moduleB.getOrCreateVisitorHash();
    expect(next).not.toBe(first);
    expect(next.length).toBeGreaterThan(0);
  });

  it("falls back to in-module memo when localStorage.getItem throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { getOrCreateVisitorHash } = await importFresh();
    const first = getOrCreateVisitorHash();
    const second = getOrCreateVisitorHash();
    expect(first.length).toBeGreaterThan(0);
    expect(first).toBe(second);
  });

  it("still returns a UUID when localStorage.setItem throws", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const { getOrCreateVisitorHash } = await importFresh();
    const first = getOrCreateVisitorHash();
    const second = getOrCreateVisitorHash();
    expect(first.length).toBeGreaterThan(0);
    expect(first).toBe(second);
  });
});

describe("getOrCreateSessionId", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns a non-empty stable value across calls", async () => {
    const { getOrCreateSessionId } = await importFresh();
    const first = getOrCreateSessionId();
    const second = getOrCreateSessionId();
    expect(first.length).toBeGreaterThan(0);
    expect(first).toBe(second);
    expect(window.sessionStorage.getItem("bf_sid")).toBe(first);
  });
});

describe("visitor + session relationship", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns distinct values for visitor vs session", async () => {
    const { getOrCreateVisitorHash, getOrCreateSessionId } = await importFresh();
    const visitor = getOrCreateVisitorHash();
    const session = getOrCreateSessionId();
    expect(visitor).not.toBe(session);
  });
});

describe("sSR fallback", () => {
  it("returns empty strings when window is undefined", async () => {
    vi.resetModules();
    const originalWindow = globalThis.window;
    // @ts-expect-error - simulate SSR by deleting window
    delete globalThis.window;
    try {
      const { getOrCreateVisitorHash, getOrCreateSessionId } =
        await import("@/lib/analytics/visitor-id");
      expect(getOrCreateVisitorHash()).toBe("");
      expect(getOrCreateSessionId()).toBe("");
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
