import { afterEach, describe, expect, it, vi } from "vitest";
import { cssColorToHex, cssColorToRgba, parseHex, rgbaToHex } from "@/lib/color";

// Vitest runs in the "node" environment, so `document` is undefined by default —
// that lets us exercise the SSR fallback directly and stub the canvas path explicitly.

describe("parseHex", () => {
  it("parses 6-digit hex", () => {
    expect(parseHex("#3366ff")).toEqual({ r: 51, g: 102, b: 255, a: 1 });
    expect(parseHex("3366ff")).toEqual({ r: 51, g: 102, b: 255, a: 1 });
  });

  it("expands 3-digit shorthand", () => {
    expect(parseHex("#36f")).toEqual({ r: 51, g: 102, b: 255, a: 1 });
  });

  it("parses 8-digit hex with alpha", () => {
    expect(parseHex("#3366ff80")).toEqual({ r: 51, g: 102, b: 255, a: 128 / 255 });
  });

  it("expands 4-digit shorthand with alpha", () => {
    expect(parseHex("#36f8")).toEqual({ r: 51, g: 102, b: 255, a: 136 / 255 });
  });

  it("rejects non-hex and wrong-length input", () => {
    expect(parseHex("red")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("")).toBeNull();
  });
});

describe("rgbaToHex", () => {
  it("drops the alpha channel when opaque", () => {
    expect(rgbaToHex(51, 102, 255, 1)).toBe("#3366ff");
  });

  it("appends the alpha channel when translucent", () => {
    expect(rgbaToHex(51, 102, 255, 128 / 255)).toBe("#3366ff80");
  });

  it("clamps out-of-range channels", () => {
    expect(rgbaToHex(-10, 300, 128, 2)).toBe("#00ff80");
  });
});

describe("cssColorToRgba / cssColorToHex — hex fast path", () => {
  it("resolves hex without touching the canvas", () => {
    expect(cssColorToRgba("#3366ff")).toEqual({ r: 51, g: 102, b: 255, a: 1 });
    expect(cssColorToHex("#3366ff80")).toBe("#3366ff");
  });

  it("returns opaque black for an empty color", () => {
    expect(cssColorToRgba("")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe("SSR fallback (no document)", () => {
  it("falls back to opaque black for named / rgb inputs", () => {
    expect(typeof document).toBe("undefined");
    expect(cssColorToRgba("red")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(cssColorToHex("rgb(255, 0, 0)")).toBe("#000000");
  });
});

describe("canvas path (browser-like document)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Fake canvas whose fillStyle setter normalizes known CSS colors to hex,
  // mirroring how a real browser resolves `named`/`rgb()` inputs.
  const stubCanvas = (lookup: Record<string, string>) => {
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => {
          let fill = "#000000";
          return {
            get fillStyle() {
              return fill;
            },
            set fillStyle(v: string) {
              fill = lookup[v] ?? (v.startsWith("#") ? v : "#000000");
            },
          };
        },
      }),
    });
  };

  it("resolves named colors via the canvas round-trip", () => {
    stubCanvas({ red: "#ff0000" });
    expect(cssColorToRgba("red")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(cssColorToHex("red")).toBe("#ff0000");
  });

  it("resolves rgb() inputs via the canvas round-trip", () => {
    stubCanvas({ "rgb(0, 128, 0)": "#008000" });
    expect(cssColorToHex("rgb(0, 128, 0)")).toBe("#008000");
  });
});
