import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { isEmailVerifiedToken } from "@/lib/server-fn/email-otp.server";

// Mirror of email-otp.ts's pack() so tests mint tokens with a known secret. getSecret()
// reads the env at call time, so overriding here is authoritative for the module too.
const SECRET = "email-otp-test-secret";
const FORM_ID = "0a418377-5392-4f55-a4ab-cca135b9b21c";

const hmac = (payload: string) => createHmac("sha256", SECRET).update(payload).digest("base64url");

const pack = (payload: Record<string, unknown>) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
};

const verifiedToken = (overrides: Record<string, unknown> = {}) =>
  pack({ t: "verified", e: "user@example.com", f: FORM_ID, x: Date.now() + 60_000, ...overrides });

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = SECRET;
});

describe("isEmailVerifiedToken", () => {
  it("accepts a valid verified token for the matching email + form", () => {
    expect(isEmailVerifiedToken(verifiedToken(), "user@example.com", FORM_ID)).toBeTruthy();
  });

  it("normalizes the submitted email (case + whitespace) before comparing", () => {
    expect(isEmailVerifiedToken(verifiedToken(), "  User@EXAMPLE.com ", FORM_ID)).toBeTruthy();
  });

  it("rejects a token minted for a different email", () => {
    expect(isEmailVerifiedToken(verifiedToken(), "other@example.com", FORM_ID)).toBeFalsy();
  });

  it("rejects a token minted for a different form", () => {
    const otherForm = "ffffffff-0000-4000-8000-000000000000";
    expect(isEmailVerifiedToken(verifiedToken(), "user@example.com", otherForm)).toBeFalsy();
  });

  it("rejects an expired token", () => {
    const expired = verifiedToken({ x: Date.now() - 1 });
    expect(isEmailVerifiedToken(expired, "user@example.com", FORM_ID)).toBeFalsy();
  });

  it("rejects a challenge-type token passed as a verified token", () => {
    const challenge = verifiedToken({ t: "challenge" });
    expect(isEmailVerifiedToken(challenge, "user@example.com", FORM_ID)).toBeFalsy();
  });

  it("rejects a token whose payload was tampered with after signing", () => {
    const token = verifiedToken();
    const [, sig] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ t: "verified", e: "attacker@evil.com", f: FORM_ID, x: Date.now() + 60_000 }),
    ).toString("base64url");
    expect(isEmailVerifiedToken(`${forgedBody}.${sig}`, "attacker@evil.com", FORM_ID)).toBeFalsy();
  });

  it("rejects a token signed with the wrong secret", () => {
    const wrongSig = createHmac("sha256", "not-the-secret")
      .update(
        Buffer.from(
          JSON.stringify({
            t: "verified",
            e: "user@example.com",
            f: FORM_ID,
            x: Date.now() + 60_000,
          }),
        ).toString("base64url"),
      )
      .digest("base64url");
    const body = Buffer.from(
      JSON.stringify({ t: "verified", e: "user@example.com", f: FORM_ID, x: Date.now() + 60_000 }),
    ).toString("base64url");
    expect(isEmailVerifiedToken(`${body}.${wrongSig}`, "user@example.com", FORM_ID)).toBeFalsy();
  });

  it("rejects malformed inputs without throwing", () => {
    expect(isEmailVerifiedToken("", "user@example.com", FORM_ID)).toBeFalsy();
    expect(isEmailVerifiedToken("garbage", "user@example.com", FORM_ID)).toBeFalsy();
    expect(isEmailVerifiedToken("a.b.c", "user@example.com", FORM_ID)).toBeFalsy();
    expect(isEmailVerifiedToken("notjson.notsig", "user@example.com", FORM_ID)).toBeFalsy();
  });
});
