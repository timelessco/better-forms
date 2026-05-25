export interface DnsInstruction {
  type: "A" | "CNAME" | "TXT";
  /** FQDN as Vercel returns it (e.g. `_vercel.acme.com`). */
  name: string;
  /**
   * Relative form within the apex (e.g. `_vercel`). Set only when `name` is a
   * FQDN under the apex and differs from `name`. Used by DNS-provider UIs that
   * auto-append the zone (Cloudflare, Namecheap, GoDaddy, etc.).
   */
  shortName?: string;
  value: string;
}

export interface VercelVerificationChallenge {
  type: string;
  domain: string;
  value: string;
}

const APEX_LABEL_COUNT = 2;

/**
 * True when `domain` has at least one subdomain label above the apex.
 * `acme.com` → false. `forms.acme.com` → true.
 *
 * We block apex domains in `addDomain` because the most common tenant scenario
 * is "forms.acme.com" alongside an existing marketing site at the apex —
 * accepting `acme.com` would let a tenant accidentally hijack their own site.
 */
export const isSubdomain = (domain: string): boolean => {
  if (!domain) return false;
  const labels = domain.split(".").filter(Boolean);
  return labels.length > APEX_LABEL_COUNT;
};

/**
 * The apex zone for a domain — the rightmost two labels.
 * `forms.acme.com` → `acme.com`. `acme.com` → `acme.com`.
 */
const apexOf = (domain: string): string => {
  const labels = domain.split(".").filter(Boolean);
  return labels.slice(-APEX_LABEL_COUNT).join(".");
};

const withShortName = (rec: DnsInstruction, apex: string): DnsInstruction => {
  if (rec.name === "@" || rec.name === apex) return rec;
  const suffix = `.${apex}`;
  if (!rec.name.endsWith(suffix)) return rec;
  const shortName = rec.name.slice(0, -suffix.length);
  if (!shortName || shortName === rec.name) return rec;
  return { ...rec, shortName };
};

export const getDnsInstructions = (
  domain: string,
  verification?: VercelVerificationChallenge[],
): DnsInstruction[] => {
  // The routing record (CNAME for subdomains, A for apex) is ALWAYS required —
  // a TXT _vercel record proves ownership but doesn't make the hostname
  // resolve. Without the routing record, visitors get NXDOMAIN.
  const labels = domain.split(".");
  const routing: DnsInstruction =
    labels.length <= APEX_LABEL_COUNT
      ? { type: "A", name: "@", value: "76.76.21.21" }
      : {
          type: "CNAME",
          name: labels.slice(0, -APEX_LABEL_COUNT).join("."),
          value: "cname.vercel-dns.com",
        };

  const apex = apexOf(domain);

  if (verification && verification.length > 0) {
    // TXT first so the user adds it before pressing Verify, then routing.
    return [
      ...verification.map((v) =>
        withShortName(
          {
            type: v.type as DnsInstruction["type"],
            name: v.domain,
            value: v.value,
          },
          apex,
        ),
      ),
      withShortName(routing, apex),
    ];
  }
  return [withShortName(routing, apex)];
};
