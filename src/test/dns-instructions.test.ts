import { describe, expect, it } from "vitest";
import { getDnsInstructions, isSubdomain } from "@/lib/dns-instructions";

describe("getDnsInstructions", () => {
  it("returns an A record at @ for an apex domain", () => {
    const instructions = getDnsInstructions("acme.com");

    expect(instructions).toStrictEqual([{ type: "A", name: "@", value: "76.76.21.21" }]);
  });

  it("returns a CNAME record for a subdomain", () => {
    const instructions = getDnsInstructions("forms.acme.com");

    expect(instructions).toStrictEqual([
      { type: "CNAME", name: "forms", value: "cname.vercel-dns.com" },
    ]);
  });

  it("uses the deepest leaf as the CNAME name", () => {
    const instructions = getDnsInstructions("forms.app.acme.com");

    expect(instructions).toStrictEqual([
      { type: "CNAME", name: "forms.app", value: "cname.vercel-dns.com" },
    ]);
  });

  it("includes a relative shortName for FQDN names that end with the apex", () => {
    // Tenants frequently see DNS providers (Cloudflare, Namecheap) auto-strip
    // the zone, so the table needs both forms to avoid double-zone configs.
    const instructions = getDnsInstructions("forms.acme.com", [
      { type: "TXT", domain: "_vercel.acme.com", value: "vc-xyz" },
    ]);

    expect(instructions[0]).toStrictEqual({
      type: "TXT",
      name: "_vercel.acme.com",
      shortName: "_vercel",
      value: "vc-xyz",
    });
    // CNAME is already relative — no shortName needed.
    expect(instructions[1]).toStrictEqual({
      type: "CNAME",
      name: "forms",
      value: "cname.vercel-dns.com",
    });
  });

  it("returns BOTH the verification TXT and the routing CNAME when a challenge is present", () => {
    // The TXT proves ownership; the CNAME makes the subdomain resolve.
    // Tenants need both — TXT alone leaves the subdomain as NXDOMAIN.
    const instructions = getDnsInstructions("forms.acme.com", [
      {
        type: "TXT",
        domain: "_vercel.forms.acme.com",
        value: "vc-domain-verify-abc123",
      },
    ]);

    expect(instructions).toStrictEqual([
      {
        type: "TXT",
        name: "_vercel.forms.acme.com",
        shortName: "_vercel.forms",
        value: "vc-domain-verify-abc123",
      },
      { type: "CNAME", name: "forms", value: "cname.vercel-dns.com" },
    ]);
  });

  it("falls back to default DNS row when verification array is empty", () => {
    const instructions = getDnsInstructions("forms.acme.com", []);

    expect(instructions).toStrictEqual([
      { type: "CNAME", name: "forms", value: "cname.vercel-dns.com" },
    ]);
  });
});

describe("isSubdomain", () => {
  it("returns false for apex domain", () => {
    expect(isSubdomain("acme.com")).toBeFalsy();
  });

  it("returns true for second-level subdomain", () => {
    expect(isSubdomain("forms.acme.com")).toBeTruthy();
  });

  it("returns true for deeper subdomains", () => {
    expect(isSubdomain("forms.app.acme.com")).toBeTruthy();
  });

  it("returns false for empty string", () => {
    expect(isSubdomain("")).toBeFalsy();
  });

  it("returns false for single label (no TLD)", () => {
    expect(isSubdomain("localhost")).toBeFalsy();
  });
});
