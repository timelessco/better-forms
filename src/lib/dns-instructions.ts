export interface DnsInstruction {
  type: "A" | "CNAME" | "TXT";
  /** FQDN as Vercel returns it (e.g. `_vercel.acme.com`). */
  name: string;
  /** Name relative to apex (e.g. `_vercel`). Set only when `name` is a FQDN under
   * the apex. For DNS UIs that auto-append the zone (Cloudflare, GoDaddy, etc.). */
  shortName?: string;
  value: string;
}

export interface VercelVerificationChallenge {
  type: string;
  domain: string;
  value: string;
}

const APEX_LABEL_COUNT = 2;

/** True if `domain` has a label above the apex. `acme.com`→false,
 * `forms.acme.com`→true. apex-hijack guard: bare apex blocked in `addDomain`
 * so a tenant can't clobber their own marketing site. */
export const isSubdomain = (domain: string): boolean => {
  if (!domain) return false;
  const labels = domain.split(".").filter(Boolean);
  return labels.length > APEX_LABEL_COUNT;
};

/** Apex zone: rightmost two labels. `forms.acme.com` → `acme.com`. */
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
  // Routing record (CNAME/subdomain, A/apex) ALWAYS required — TXT proves
  // ownership but doesn't resolve; without it visitors get NXDOMAIN.
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
    // TXT first (added before Verify), then routing.
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
