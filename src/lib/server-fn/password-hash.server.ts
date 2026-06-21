import "@tanstack/react-start/server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Server-only form-password hashing. node:crypto must never reach the client bundle;
 * the `.server.ts` suffix strips it. Format: scrypt$<saltHex>$<hashHex> — self-describing
 * so we can evolve params (scrypt2$/argon2$) without breaking existing hashes. */

const PREFIX = "scrypt$";

export const hashFormPassword = (plain: string): string => {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `${PREFIX}${salt.toString("hex")}$${hash.toString("hex")}`;
};

export const isHashedFormPassword = (stored: string): boolean => stored.startsWith(PREFIX);

/** Verify against a scrypt$ hash. Returns false for legacy plaintext — the caller handles that. */
export const verifyFormPasswordHash = (plain: string, stored: string): boolean => {
  if (!isHashedFormPassword(stored)) return false;
  const [, saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(plain, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
