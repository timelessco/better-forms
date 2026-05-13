import { describe, expect, it } from "vitest";
import { APP_WEBSITE_URL } from "@/lib/config/app-config";
import { buildOgImageUrl } from "@/lib/og/url";

describe("buildOgImageUrl", () => {
  it("anchors at APP_WEBSITE_URL regardless of caller's origin", () => {
    const url = buildOgImageUrl({
      shortId: "abc",
      title: "Hi",
      description: "World",
    });
    expect(url.startsWith(`${APP_WEBSITE_URL}/api/og/abc/`)).toBeTruthy();
    expect(url.endsWith(".png")).toBeTruthy();
  });

  it("uRL changes when title changes", () => {
    const a = buildOgImageUrl({ shortId: "abc", title: "A", description: "" });
    const b = buildOgImageUrl({ shortId: "abc", title: "B", description: "" });
    expect(a).not.toBe(b);
  });

  it("uRL is stable for identical inputs", () => {
    const a = buildOgImageUrl({ shortId: "abc", title: "A", description: "x" });
    const b = buildOgImageUrl({ shortId: "abc", title: "A", description: "x" });
    expect(a).toBe(b);
  });

  it("does not produce a double slash when APP_WEBSITE_URL has a trailing slash", () => {
    const url = buildOgImageUrl({ shortId: "abc", title: "Hi", description: "" });
    expect(url).not.toContain("//api/og/");
    expect(url).toMatch(/^https?:\/\/[^/]+\/api\/og\/abc\//);
  });
});
