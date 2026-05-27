import { describe, expect, it } from "vitest";
import { resolveSource } from "@/lib/analytics/source";

describe("resolveSource", () => {
  it("uses an explicit utm_source when present (trimmed, verbatim)", () => {
    expect(resolveSource({ utmSource: "twitter" })).toBe("twitter");
    expect(resolveSource({ utmSource: "Summer Campaign" })).toBe("Summer Campaign");
    expect(resolveSource({ utmSource: "  newsletter  " })).toBe("newsletter");
  });

  it("prefers utm_source over the referrer", () => {
    expect(resolveSource({ utmSource: "newsletter", referrer: "https://twitter.com/x" })).toBe(
      "newsletter",
    );
  });

  it("maps known referrer domains to a canonical source", () => {
    expect(resolveSource({ referrer: "https://twitter.com/foo" })).toBe("twitter");
    expect(resolveSource({ referrer: "https://t.co/abc" })).toBe("twitter");
    expect(resolveSource({ referrer: "https://x.com/foo" })).toBe("twitter");
    expect(resolveSource({ referrer: "https://www.linkedin.com/feed" })).toBe("linkedin");
    expect(resolveSource({ referrer: "https://lnkd.in/xyz" })).toBe("linkedin");
    expect(resolveSource({ referrer: "https://app.slack.com/client/x" })).toBe("slack");
    expect(resolveSource({ referrer: "https://news.ycombinator.com/item?id=1" })).toBe(
      "hackernews",
    );
  });

  it("maps search engines across TLDs via prefix", () => {
    expect(resolveSource({ referrer: "https://www.google.co.in/search?q=x" })).toBe("google");
    expect(resolveSource({ referrer: "https://google.com" })).toBe("google");
    expect(resolveSource({ referrer: "https://bing.com/search" })).toBe("bing");
  });

  it("falls back to the bare referrer host for unknown domains", () => {
    expect(resolveSource({ referrer: "https://medium.com/@author/post" })).toBe("medium.com");
    expect(resolveSource({ referrer: "https://www.example.com/page" })).toBe("example.com");
  });

  it("treats loopback / dev hosts as direct (not a real source)", () => {
    expect(resolveSource({ referrer: "http://localhost:3000/forms/x" })).toBe("direct");
    expect(resolveSource({ referrer: "http://127.0.0.1:5173/" })).toBe("direct");
    expect(resolveSource({ referrer: "http://app.localhost/" })).toBe("direct");
  });

  it("maps Android in-app referrers (android-app://<package>)", () => {
    expect(resolveSource({ referrer: "android-app://com.Slack" })).toBe("slack");
    expect(resolveSource({ referrer: "android-app://com.twitter.android/x" })).toBe("twitter");
    expect(resolveSource({ referrer: "android-app://com.linkedin.android" })).toBe("linkedin");
  });

  it("returns 'direct' when there is no utm and no usable referrer", () => {
    expect(resolveSource({})).toBe("direct");
    expect(resolveSource({ utmSource: null, referrer: null })).toBe("direct");
    expect(resolveSource({ referrer: "" })).toBe("direct");
    expect(resolveSource({ utmSource: "   " })).toBe("direct");
    expect(resolveSource({ referrer: "not a url" })).toBe("direct");
  });
});
