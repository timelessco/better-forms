import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocked per-test to feed isCronAuthorized() a request-scoped Headers object.
const mockGetRequestHeaders = vi.fn<() => Headers>();

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => mockGetRequestHeaders(),
}));

const { isCronAuthorized } = await import("./cron-auth");

const SECRET = "s3cr3t-token";

describe("isCronAuthorized", () => {
  const origSecret = process.env.CRON_SECRET;
  const origVercel = process.env.VERCEL;

  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL;
    mockGetRequestHeaders.mockReset();
  });

  afterEach(() => {
    if (origSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = origSecret;
    if (origVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = origVercel;
  });

  it("authorizes a valid Bearer CRON_SECRET when the secret is set", () => {
    process.env.CRON_SECRET = SECRET;
    mockGetRequestHeaders.mockReturnValue(new Headers({ authorization: `Bearer ${SECRET}` }));
    expect(isCronAuthorized()).toBe(true);
  });

  it("rejects a wrong bearer token when the secret is set", () => {
    process.env.CRON_SECRET = SECRET;
    mockGetRequestHeaders.mockReturnValue(new Headers({ authorization: "Bearer nope" }));
    expect(isCronAuthorized()).toBe(false);
  });

  it("rejects x-vercel-cron alone (no bearer) when the secret is set", () => {
    process.env.CRON_SECRET = SECRET;
    process.env.VERCEL = "1";
    mockGetRequestHeaders.mockReturnValue(new Headers({ "x-vercel-cron": "1" }));
    expect(isCronAuthorized()).toBe(false);
  });

  it("authorizes x-vercel-cron when secret is unset and running on Vercel", () => {
    process.env.VERCEL = "1";
    mockGetRequestHeaders.mockReturnValue(new Headers({ "x-vercel-cron": "1" }));
    expect(isCronAuthorized()).toBe(true);
  });

  it("rejects x-vercel-cron when secret is unset and not on Vercel", () => {
    mockGetRequestHeaders.mockReturnValue(new Headers({ "x-vercel-cron": "1" }));
    expect(isCronAuthorized()).toBe(false);
  });
});
