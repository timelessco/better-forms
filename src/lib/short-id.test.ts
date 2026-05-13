import { describe, expect, it } from "vitest";
import {
  SHORT_ID_ALPHABET,
  SHORT_ID_LENGTH,
  generateShortId,
  isValidShortId,
} from "@/lib/short-id";

describe("Form Short ID generator", () => {
  it("emits 7-char base62 strings", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateShortId();
      expect(id).toHaveLength(SHORT_ID_LENGTH);
      for (const ch of id) {
        expect(SHORT_ID_ALPHABET).toContain(ch);
      }
    }
  });

  it("rarely repeats across many calls (sanity check, not a guarantee)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateShortId());
    // With 62^7 = 3.5T namespace, 1000 draws colliding is vanishingly rare.
    // We assert no duplicates rather than a probabilistic bound so the test
    // is deterministic.
    expect(seen.size).toBe(1000);
  });
});

describe("isValidShortId", () => {
  it.each([
    ["abc1234", true],
    ["ABCdef9", true],
    ["0000000", true],
    ["zzzzzzz", true],
  ])("%s → %s", (input, expected) => {
    expect(isValidShortId(input)).toBe(expected);
  });

  it.each([
    ["abc-123", false], // hyphen not in base62
    ["abc_123", false], // underscore not in base62
    ["abc12345", false], // 8 chars
    ["abc12", false], // 5 chars
    ["", false],
    ["abcde fg", false], // space
  ])("%s rejected", (input) => {
    expect(isValidShortId(input)).toBe(false);
  });
});
