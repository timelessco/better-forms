export type FileTypeCategory = "all" | "images" | "documents" | "spreadsheets";

export type FileSubtype = {
  id: string;
  label: string;
  extensions: string[];
  mimeTypes: string[];
};

export const FILE_TYPE_CATEGORY_LABELS: Record<FileTypeCategory, string> = {
  all: "All files",
  images: "Images",
  documents: "Documents",
  spreadsheets: "Spreadsheets",
};

export const FILE_SUBTYPES: Record<Exclude<FileTypeCategory, "all">, FileSubtype[]> = {
  images: [
    { id: "jpeg", label: "JPEG", extensions: [".jpg", ".jpeg"], mimeTypes: ["image/jpeg"] },
    { id: "png", label: "PNG", extensions: [".png"], mimeTypes: ["image/png"] },
    { id: "gif", label: "GIF", extensions: [".gif"], mimeTypes: ["image/gif"] },
    { id: "webp", label: "WEBP", extensions: [".webp"], mimeTypes: ["image/webp"] },
  ],
  documents: [
    { id: "pdf", label: "PDF", extensions: [".pdf"], mimeTypes: ["application/pdf"] },
    { id: "doc", label: "DOC", extensions: [".doc"], mimeTypes: ["application/msword"] },
    {
      id: "docx",
      label: "DOCX",
      extensions: [".docx"],
      mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    },
    { id: "txt", label: "TXT", extensions: [".txt"], mimeTypes: ["text/plain"] },
  ],
  spreadsheets: [
    {
      id: "xlsx",
      label: "XLSX",
      extensions: [".xlsx"],
      mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    },
    {
      id: "xls",
      label: "XLS",
      extensions: [".xls"],
      mimeTypes: ["application/vnd.ms-excel"],
    },
    { id: "csv", label: "CSV", extensions: [".csv"], mimeTypes: ["text/csv"] },
  ],
};

const ALL_FILES_ACCEPT = "image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.csv";

export const DEFAULT_MAX_FILE_SIZE_MB = 10;

// Absolute ceiling for any file field, regardless of per-field config. Bounds
// worst-case stored size; enforced both client-side (picker pre-check) and
// server-side (Blob `maximumSizeInBytes` via the upload token route).
export const MAX_FILE_SIZE_HARD_CAP_MB = 15;

export const isFileTypeCategory = (value: unknown): value is FileTypeCategory =>
  value === "all" || value === "images" || value === "documents" || value === "spreadsheets";

const subtypesForCategory = (category: FileTypeCategory): FileSubtype[] => {
  if (category === "all") return [];
  return FILE_SUBTYPES[category];
};

const filterSubtypes = (
  category: Exclude<FileTypeCategory, "all">,
  ids: string[] | undefined,
): FileSubtype[] => {
  const all = FILE_SUBTYPES[category];
  if (!ids || ids.length === 0) return all;
  const idSet = new Set(ids);
  const filtered = all.filter((s) => idSet.has(s.id));
  return filtered.length > 0 ? filtered : all;
};

/** Effective accepted subtypes. "all" → `[]` (caller uses all-files accept);
 * empty/undefined `ids` → every subtype in the category. */
export const resolveAllowedSubtypes = (
  category: unknown,
  ids: unknown,
): { category: FileTypeCategory; subtypes: FileSubtype[] } => {
  const cat = isFileTypeCategory(category) ? category : "all";
  if (cat === "all") return { category: cat, subtypes: [] };
  const idsArray = Array.isArray(ids) ? ids.filter((i): i is string => typeof i === "string") : [];
  return { category: cat, subtypes: filterSubtypes(cat, idsArray) };
};

/** HTML `accept` string for the picker / `useFileUpload`. Extensions + MIME so
 * both pre-pick filtering and post-pick validation work. */
export const buildAcceptString = (category: FileTypeCategory, subtypes: FileSubtype[]): string => {
  if (category === "all") return ALL_FILES_ACCEPT;
  if (subtypes.length === 0) return ALL_FILES_ACCEPT;
  const tokens: string[] = [];
  for (const s of subtypes) {
    tokens.push(...s.mimeTypes, ...s.extensions);
  }
  return tokens.join(",");
};

/** Human-readable list ("PNG, JPG, GIF") for the upload placeholder. */
export const buildPlaceholderLabel = (
  category: FileTypeCategory,
  subtypes: FileSubtype[],
): string => {
  if (category === "all") return "PNG, JPG, PDF";
  const list = subtypes.length > 0 ? subtypes : subtypesForCategory(category);
  return list.map((s) => s.label).join(", ");
};

// Maps a dotted extension (".pdf") to its MIME type(s).
const MIME_BY_EXT: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const subtypes of Object.values(FILE_SUBTYPES)) {
    for (const subtype of subtypes) {
      for (const ext of subtype.extensions) {
        map[ext] = subtype.mimeTypes;
      }
    }
  }
  return map;
})();

/**
 * Converts an HTML `accept` string (mix of `image/*`, explicit MIME types, and
 * dotted extensions) into a flat list of media types. Wildcards and explicit
 * MIME types pass through; extensions resolve via {@link MIME_BY_EXT}. Feeds
 * Vercel Blob's `allowedContentTypes`, which it enforces at upload time — the
 * server-side backstop for the client picker's `accept` pre-filtering.
 */
export const acceptStringToContentTypes = (accept: string): string[] => {
  const out = new Set<string>();
  for (const raw of accept.split(",")) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    if (token.startsWith(".")) {
      for (const mime of MIME_BY_EXT[token] ?? []) out.add(mime);
    } else if (token.includes("/")) {
      // `image/*` wildcard or an explicit media type — Blob accepts both.
      out.add(token);
    }
  }
  return [...out];
};

type FileUploadNodeFields = {
  maxFileSize?: number;
  maxFiles?: number;
  allowedFileTypes?: string;
  allowedFileExtensions?: string[];
};

export const extractFileUploadFields = (node: Record<string, unknown>): FileUploadNodeFields => ({
  maxFileSize: node.maxFileSize as number | undefined,
  maxFiles: node.maxFiles as number | undefined,
  allowedFileTypes: node.allowedFileTypes as string | undefined,
  allowedFileExtensions: node.allowedFileExtensions as string[] | undefined,
});

/** A file that has been uploaded to storage and referenced by submission
 *  payloads — the URL plus display metadata, never the bytes. */
export type UploadedFormFile = {
  url: string;
  name: string;
  size: number;
  type: string;
};
