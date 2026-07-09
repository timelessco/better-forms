// Client-side "Detected provider" lookup (Figma 26286:8070). We resolve the domain's
// authoritative nameservers via DNS-over-HTTPS (Google DoH, JSON) and map a known NS
// suffix to a human name + management dashboard URL. Best-effort, read-only, no backend.

export interface DetectedProvider {
  name: string;
  dashboardUrl?: string;
}

// Matched against the lowercased nameserver hostname (suffix / substring).
const PROVIDER_SIGNATURES: { match: string; name: string; dashboardUrl?: string }[] = [
  { match: "cloudflare.com", name: "Cloudflare", dashboardUrl: "https://dash.cloudflare.com/" },
  { match: "domaincontrol.com", name: "GoDaddy", dashboardUrl: "https://dcc.godaddy.com/" },
  {
    match: "awsdns",
    name: "Amazon Route 53",
    dashboardUrl: "https://console.aws.amazon.com/route53/",
  },
  { match: "azure-dns", name: "Azure DNS", dashboardUrl: "https://portal.azure.com/" },
  {
    match: "googledomains.com",
    name: "Google Domains",
    dashboardUrl: "https://domains.google.com/",
  },
  {
    match: "namecheaphosting.com",
    name: "Namecheap",
    dashboardUrl: "https://ap.www.namecheap.com/",
  },
  {
    match: "registrar-servers.com",
    name: "Namecheap",
    dashboardUrl: "https://ap.www.namecheap.com/",
  },
  {
    match: "digitalocean.com",
    name: "DigitalOcean",
    dashboardUrl: "https://cloud.digitalocean.com/networking/domains",
  },
  { match: "dnsimple.com", name: "DNSimple", dashboardUrl: "https://dnsimple.com/dashboard" },
  { match: "name-services.com", name: "Enom", dashboardUrl: "https://www.enom.com/" },
  { match: "vercel-dns.com", name: "Vercel", dashboardUrl: "https://vercel.com/dashboard/domains" },
  { match: "nsone.net", name: "NS1", dashboardUrl: "https://my.nsone.net/" },
  { match: "dnsmadeeasy.com", name: "DNS Made Easy", dashboardUrl: "https://cp.dnsmadeeasy.com/" },
];

const APEX_LABEL_COUNT = 2;

const apexOf = (domain: string): string =>
  domain.split(".").filter(Boolean).slice(-APEX_LABEL_COUNT).join(".");

interface DohAnswer {
  data?: string;
}
interface DohResponse {
  Answer?: DohAnswer[];
}

/** Resolve the domain's NS records via Google DoH and map them to a known provider.
 * Returns null when the lookup fails or no signature matches. */
export const detectDnsProvider = async (
  domain: string,
  signal?: AbortSignal,
): Promise<DetectedProvider | null> => {
  const apex = apexOf(domain);
  if (!apex) return null;

  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(apex)}&type=NS`, {
    signal,
    headers: { accept: "application/dns-json" },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as DohResponse;
  const nameservers = (json.Answer ?? [])
    .map((a) => a.data?.replace(/\.$/, "").toLowerCase())
    .filter((v): v is string => Boolean(v));
  if (nameservers.length === 0) return null;

  for (const ns of nameservers) {
    const hit = PROVIDER_SIGNATURES.find((sig) => ns.includes(sig.match));
    if (hit) return { name: hit.name, dashboardUrl: hit.dashboardUrl };
  }

  // Unknown provider: surface the registrable NS domain so the row still informs.
  return { name: apexOf(nameservers[0]) };
};
