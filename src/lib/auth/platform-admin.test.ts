import { afterEach, beforeEach, expect, it } from "vitest";
import { isPlatformAdminEmail } from "./platform-admin";

const ORIGINAL = process.env.PLATFORM_ADMIN_EMAILS;
beforeEach(() => {
  process.env.PLATFORM_ADMIN_EMAILS = "Admin@Timeless.co, ops@timeless.co";
});
afterEach(() => {
  process.env.PLATFORM_ADMIN_EMAILS = ORIGINAL;
});

it("matches case-insensitively and trims", () => {
  expect(isPlatformAdminEmail("admin@timeless.co")).toBe(true);
  expect(isPlatformAdminEmail("ops@timeless.co")).toBe(true);
  expect(isPlatformAdminEmail("nope@timeless.co")).toBe(false);
  expect(isPlatformAdminEmail(undefined)).toBe(false);
});

it("returns false when env unset", () => {
  delete process.env.PLATFORM_ADMIN_EMAILS;
  expect(isPlatformAdminEmail("admin@timeless.co")).toBe(false);
});
