import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { FieldType } from "@/components/form-components/fields/shared";

type ViteManifestEntry = {
  file: string;
  imports?: string[];
  css?: string[];
};
type ViteManifest = Record<string, ViteManifestEntry>;

// Must match the import() specifiers in render-step-preview-input.tsx so Vite emits manifest keys.
const SOURCE_PATHS: Record<FieldType, string> = {
  Input: "src/components/form-components/fields/InputField.tsx",
  Textarea: "src/components/form-components/fields/TextareaField.tsx",
  Email: "src/components/form-components/fields/EmailField.tsx",
  Phone: "src/components/form-components/fields/PhoneField.tsx",
  Number: "src/components/form-components/fields/NumberField.tsx",
  Link: "src/components/form-components/fields/LinkField.tsx",
  Date: "src/components/form-components/fields/DateField.tsx",
  Time: "src/components/form-components/fields/TimeField.tsx",
  FileUpload: "src/components/form-components/fields/FileUploadField.tsx",
  Checkbox: "src/components/form-components/fields/CheckboxField.tsx",
  MultiChoice: "src/components/form-components/fields/MultiChoiceField.tsx",
  MultiSelect: "src/components/form-components/fields/MultiSelectField.tsx",
  Ranking: "src/components/form-components/fields/RankingField.tsx",
  Dropdown: "src/components/form-components/fields/DropdownField.tsx",
};

// Paths Vite/Nitro may place the client manifest at, in priority order.
const MANIFEST_CANDIDATES = [
  ".output/public/.vite/manifest.json",
  "dist/client/.vite/manifest.json",
  "dist/.vite/manifest.json",
];

let cached: ViteManifest | null | undefined;

const loadManifest = async (): Promise<ViteManifest | null> => {
  if (cached !== undefined) return cached;
  // Never read prod manifest in dev: a stale .output manifest leaks hashed chunk URLs into
  // <link modulepreload> that Vite's dev server 404s (it serves source paths).
  if (process.env.NODE_ENV !== "production") {
    cached = null;
    return null;
  }
  for (const rel of MANIFEST_CANDIDATES) {
    try {
      const raw = await readFile(join(process.cwd(), rel), "utf8");
      cached = JSON.parse(raw) as ViteManifest;
      return cached;
    } catch {
      // try next
    }
  }
  cached = null;
  return null;
};

// Collect chunk + transitive imports for a source key → full modulepreload graph per widget.
const collectChunkUrls = (
  manifest: ViteManifest,
  sourceKey: string,
  urls: Set<string>,
  visited: Set<string>,
) => {
  if (visited.has(sourceKey)) return;
  visited.add(sourceKey);
  const entry = manifest[sourceKey];
  if (!entry) return;
  urls.add(`/${entry.file}`);
  if (entry.imports) {
    for (const dep of entry.imports) {
      collectChunkUrls(manifest, dep, urls, visited);
    }
  }
};

// Returns absolute asset URLs for the widget chunks of the given field types,
// including transitive imports. Empty in dev (no manifest).
export const getFieldChunkUrls = async (fieldTypes: string[]): Promise<string[]> => {
  const manifest = await loadManifest();
  if (!manifest) return [];
  const urls = new Set<string>();
  const visited = new Set<string>();
  for (const ft of fieldTypes) {
    const src = SOURCE_PATHS[ft as FieldType];
    if (src) collectChunkUrls(manifest, src, urls, visited);
  }
  return [...urls];
};
