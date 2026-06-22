import { describe, expect, it } from "vitest";
import {
  hashFormPassword,
  isHashedFormPassword,
  verifyFormPasswordHash,
} from "@/lib/server-fn/password-hash.server";

describe("form password hashing", () => {
  it("hashes with a scrypt$ prefix", () => {
    expect(hashFormPassword("hunter2").startsWith("scrypt$")).toBe(true);
  });

  it("produces a different hash each call (random salt)", () => {
    expect(hashFormPassword("hunter2")).not.toBe(hashFormPassword("hunter2"));
  });

  it("verifies the correct password", () => {
    expect(verifyFormPasswordHash("hunter2", hashFormPassword("hunter2"))).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyFormPasswordHash("wrong", hashFormPassword("hunter2"))).toBe(false);
  });

  it("rejects a legacy plaintext string (not a hash)", () => {
    expect(verifyFormPasswordHash("hunter2", "hunter2")).toBe(false);
  });

  it("isHashedFormPassword distinguishes hashes from plaintext", () => {
    expect(isHashedFormPassword(hashFormPassword("hunter2"))).toBe(true);
    expect(isHashedFormPassword("hunter2")).toBe(false);
  });
});
