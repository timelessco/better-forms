import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vercelDomains } from "@/lib/vercel-domains.server";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("vercelDomains.remove", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    process.env.VERCEL_PROJECT_ID = "prj_test";
    process.env.VERCEL_TOKEN = "token";
    process.env.VERCEL_TEAM_ID = "team_1";
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls project-domain detach AND account-level domain delete", async () => {
    // Each call needs a fresh Response — bodies are consumed once. Sharing a
    // single Response across both fetch calls would throw "Body unusable".
    fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(jsonResponse({}));

    await vercelDomains.remove("acme.com");

    // SDK passes a Request object, not a (url, init) pair.
    const requests = fetchMock.mock.calls.map((call) => call[0] as Request);
    const urls = requests.map((r) => r.url);
    expect(urls.some((u) => u.includes("/projects/prj_test/domains/acme.com"))).toBeTruthy();
    expect(urls.some((u) => u.includes("/v6/domains/acme.com"))).toBeTruthy();
    for (const req of requests) {
      expect(req.method).toBe("DELETE");
    }
  });

  it("treats 404 from account-level delete as success", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "not found" } }, 404));

    await expect(vercelDomains.remove("acme.com")).resolves.toBeUndefined();
  });

  it("throws when account-level delete fails non-404", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "boom" } }, 500));

    await expect(vercelDomains.remove("acme.com")).rejects.toThrow("boom");
  });
});

describe("vercelDomains.add", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    process.env.VERCEL_PROJECT_ID = "prj_test";
    process.env.VERCEL_TOKEN = "token";
    process.env.VERCEL_TEAM_ID = "team_1";
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns verification challenge when Vercel responds 4xx with one (domain_already_in_use)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "domain_already_in_use",
            message: "domain already in use",
            verification: [{ type: "TXT", domain: "_vercel.acme.com", value: "vc-xyz" }],
          },
        },
        409,
      ),
    );

    const result = await vercelDomains.add("acme.com");

    expect(result.verified).toBeFalsy();
    expect(result.verification).toStrictEqual([
      { type: "TXT", domain: "_vercel.acme.com", value: "vc-xyz" },
    ]);
  });

  it("throws when 4xx has no verification challenge", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: "invalid domain" } }, 400));

    await expect(vercelDomains.add("acme.com")).rejects.toThrow("invalid domain");
  });
});
