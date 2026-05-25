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

/**
 * Resolves the effective subtypes a field accepts. When the category is "all",
 * returns an empty array (caller falls back to the all-files accept string).
 * When `ids` is empty/undefined, returns every subtype in the category.
 */
export const resolveAllowedSubtypes = (
  category: unknown,
  ids: unknown,
): { category: FileTypeCategory; subtypes: FileSubtype[] } => {
  const cat = isFileTypeCategory(category) ? category : "all";
  if (cat === "all") return { category: cat, subtypes: [] };
  const idsArray = Array.isArray(ids) ? ids.filter((i): i is string => typeof i === "string") : [];
  return { category: cat, subtypes: filterSubtypes(cat, idsArray) };
};

/**
 * HTML `accept` attribute string for the file picker / `useFileUpload` hook.
 * Combines extensions and MIME types so both pre-pick filtering and post-pick
 * validation work.
 */
export const buildAcceptString = (category: FileTypeCategory, subtypes: FileSubtype[]): string => {
  if (category === "all") return ALL_FILES_ACCEPT;
  if (subtypes.length === 0) return ALL_FILES_ACCEPT;
  const tokens: string[] = [];
  for (const s of subtypes) {
    tokens.push(...s.mimeTypes, ...s.extensions);
  }
  return tokens.join(",");
};

/**
 * Human-readable list ("PNG, JPG, GIF") for the upload block placeholder.
 */
export const buildPlaceholderLabel = (
  category: FileTypeCategory,
  subtypes: FileSubtype[],
): string => {
  if (category === "all") return "PNG, JPG, PDF";
  const list = subtypes.length > 0 ? subtypes : subtypesForCategory(category);
  return list.map((s) => s.label).join(", ");
};

// Non-canonical MIME aliases that browsers/legacy uploads still emit.
const MIME_EXT_ALIASES: Record<string, string> = {
  "image/jpg": "jpg",
  "application/csv": "csv",
};

const EXT_BY_MIME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const subtypes of Object.values(FILE_SUBTYPES)) {
    for (const subtype of subtypes) {
      const ext = subtype.extensions[0]?.replace(/^\./, "");
      if (!ext) continue;
      for (const mime of subtype.mimeTypes) {
        map[mime] = ext;
      }
    }
  }
  return { ...map, ...MIME_EXT_ALIASES };
})();

export const getExtensionForMime = (contentType: string): string | undefined =>
  EXT_BY_MIME[contentType.toLowerCase()];

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
