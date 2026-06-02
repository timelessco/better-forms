const VERCEL_BLOB_HOST = ".public.blob.vercel-storage.com";
const UNSPLASH_HOST = "images.unsplash.com";

// URL-valued fields we treat as assets across known node shapes.
const ASSET_FIELDS = ["url", "icon", "cover", "src"] as const;
// Media node types whose primary asset is `url`; if stripped, the node is dropped.
const MEDIA_TYPES = new Set(["img", "image", "audio", "video"]);

export type UrlClass = "blob" | "keep" | "strip";

export const classifyUrl = (value: unknown): UrlClass => {
  if (typeof value !== "string") return "strip";
  // Parse + match on hostname, not a substring of the whole URL — else
  // `https://evil.com/?x=images.unsplash.com` or `https://images.unsplash.com.evil.com`
  // slips through and copyAsset() fetches it server-side (SSRF).
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "strip";
  }
  // https only; reject embedded credentials (userinfo).
  if (url.protocol !== "https:" || url.username || url.password) return "strip";
  const host = url.hostname.toLowerCase().replace(/\.$/, ""); // drop trailing-dot FQDN
  if (host === UNSPLASH_HOST) return "keep";
  // VERCEL_BLOB_HOST is a `.…` suffix; require a real subdomain before it.
  if (host.endsWith(VERCEL_BLOB_HOST) && host.length > VERCEL_BLOB_HOST.length) return "blob";
  return "strip";
};

interface SanitizeOptions {
  // Copies a source vercel-blob URL into template-owned storage, returns the new URL.
  copyAsset: (sourceUrl: string) => Promise<string>;
}

interface SanitizeResult {
  content: unknown[];
  assetUrls: string[]; // template-owned blob URLs created, for later del() cleanup
}

// Recursively rewrite/strip a single node's asset fields. Returns null if the node must be dropped.
const processNode = async (
  node: Record<string, unknown>,
  copyAsset: SanitizeOptions["copyAsset"],
  assetUrls: string[],
): Promise<Record<string, unknown> | null> => {
  // Strip logic redirect actions (author-environment-specific).
  for (const key of ["actions", "elseActions"]) {
    const actions = node[key];
    if (Array.isArray(actions)) {
      node[key] = actions.filter(
        (a) => !(a && typeof a === "object" && (a as { kind?: string }).kind === "redirect"),
      );
    }
  }

  for (const field of ASSET_FIELDS) {
    if (!(field in node)) continue;
    const cls = classifyUrl(node[field]);
    if (cls === "blob") {
      const newUrl = await copyAsset(node[field] as string);
      node[field] = newUrl;
      assetUrls.push(newUrl);
    } else if (cls === "strip") {
      // Drop media nodes that lose their primary url; otherwise null the field.
      if (field === "url" && MEDIA_TYPES.has(String(node.type))) return null;
      node[field] = null;
    } // "keep" → leave as-is
  }

  if (Array.isArray(node.children)) {
    const kids: unknown[] = [];
    for (const child of node.children as unknown[]) {
      if (child && typeof child === "object") {
        const processed = await processNode(child as Record<string, unknown>, copyAsset, assetUrls);
        if (processed) kids.push(processed);
      } else {
        kids.push(child);
      }
    }
    node.children = kids;
  }
  return node;
};

export const sanitizeTemplateContent = async (
  content: unknown[],
  { copyAsset }: SanitizeOptions,
): Promise<SanitizeResult> => {
  const cloned = structuredClone(content);
  const assetUrls: string[] = [];
  const out: unknown[] = [];
  for (const node of cloned) {
    if (node && typeof node === "object") {
      const processed = await processNode(node as Record<string, unknown>, copyAsset, assetUrls);
      if (processed) out.push(processed);
    } else {
      out.push(node);
    }
  }
  return { content: out, assetUrls };
};
