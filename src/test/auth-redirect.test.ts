import { describe, it, expect } from "vitest";
import { pickPostLoginRedirect } from "@/lib/auth/middleware";
import { isSafeRedirect } from "@/lib/auth/safe-redirect";

describe("pickPostLoginRedirect", () => {
  const noHeaders = new Headers();

  it("returns the pathname when it's a normal page route", () => {
    expect(pickPostLoginRedirect("/dashboard", noHeaders)).toBe("/dashboard");
    expect(pickPostLoginRedirect("/workspace/abc/forms", noHeaders)).toBe("/workspace/abc/forms");
  });

  it("rejects /_serverFn/ paths and falls back to /dashboard when no referer", () => {
    expect(
      pickPostLoginRedirect("/_serverFn/3d639c1b03e217b64521063eef826d66691aac3fb", noHeaders),
    ).toBe("/dashboard");
  });

  it("rejects /api/ paths and falls back to /dashboard when no referer", () => {
    expect(pickPostLoginRedirect("/api/track/visit-end", noHeaders)).toBe("/dashboard");
  });

  it("uses Referer pathname when the request URL is an internal path", () => {
    const headers = new Headers({ referer: "https://app.example.com/workspace/abc/forms" });
    expect(pickPostLoginRedirect("/_serverFn/abcdef", headers)).toBe("/workspace/abc/forms");
  });

  it("ignores Referer that itself points at an internal path", () => {
    const headers = new Headers({ referer: "https://app.example.com/_serverFn/cafebabe" });
    expect(pickPostLoginRedirect("/_serverFn/abcdef", headers)).toBe("/dashboard");
  });

  it("ignores a malformed Referer header", () => {
    const headers = new Headers({ referer: "not-a-url" });
    expect(pickPostLoginRedirect("/_serverFn/abcdef", headers)).toBe("/dashboard");
  });
});

describe("isSafeRedirect", () => {
  it("accepts normal page paths", () => {
    expect(isSafeRedirect("/dashboard")).toBe(true);
    expect(isSafeRedirect("/workspace/abc/forms/def")).toBe(true);
    expect(isSafeRedirect("/settings")).toBe(true);
  });

  it("rejects /_serverFn/ and other /_-prefixed paths", () => {
    expect(isSafeRedirect("/_serverFn/3d639c1b03e217b64521063eef826d66691aac3fb")).toBe(false);
    expect(isSafeRedirect("/_build/assets/main.js")).toBe(false);
  });

  it("rejects /api/ paths", () => {
    expect(isSafeRedirect("/api/track/visit-end")).toBe(false);
    expect(isSafeRedirect("/api/auth/magic-link/verify")).toBe(false);
  });

  it("rejects absolute URLs (open-redirect guard)", () => {
    expect(isSafeRedirect("https://evil.example.com/phish")).toBe(false);
    expect(isSafeRedirect("//evil.example.com")).toBe(false);
  });

  it("rejects paths with disallowed chars", () => {
    expect(isSafeRedirect("/dashboard?foo=bar")).toBe(false);
    expect(isSafeRedirect("/dashboard#section")).toBe(false);
    expect(isSafeRedirect("/dashboard with space")).toBe(false);
  });

  it("rejects null, undefined, and empty strings", () => {
    expect(isSafeRedirect(null)).toBe(false);
    expect(isSafeRedirect(undefined)).toBe(false);
    expect(isSafeRedirect("")).toBe(false);
  });
});
