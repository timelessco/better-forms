// File-upload allow-list model. Selection is a flat set of extension strings (e.g. ".jpg")
// spanning categories, persisted on the node as `allowedFileExtensions`. Empty/undefined ⇒ the
// image-only default. Categories below drive the block-menu "Allowed files" picker (Figma 25633-11852).

export interface FileExtensionDef {
  /** Dotted extension, lower-case, e.g. ".jpg" — also the selection key. */
  ext: string;
  mimeTypes: string[];
}

export interface FileCategoryDef {
  id: string;
  label: string;
  extensions: FileExtensionDef[];
}

export const FILE_CATEGORIES: FileCategoryDef[] = [
  {
    id: "image",
    label: "Image",
    extensions: [
      { ext: ".jpg", mimeTypes: ["image/jpeg"] },
      { ext: ".jpeg", mimeTypes: ["image/jpeg"] },
      { ext: ".png", mimeTypes: ["image/png"] },
      { ext: ".gif", mimeTypes: ["image/gif"] },
      { ext: ".svg", mimeTypes: ["image/svg+xml"] },
      { ext: ".heic", mimeTypes: ["image/heic"] },
      { ext: ".webp", mimeTypes: ["image/webp"] },
      { ext: ".bmp", mimeTypes: ["image/bmp"] },
      { ext: ".psd", mimeTypes: ["image/vnd.adobe.photoshop"] },
    ],
  },
  {
    id: "video",
    label: "Video",
    extensions: [
      { ext: ".mp4", mimeTypes: ["video/mp4"] },
      { ext: ".mov", mimeTypes: ["video/quicktime"] },
      { ext: ".webm", mimeTypes: ["video/webm"] },
    ],
  },
  {
    id: "audio",
    label: "Audio",
    extensions: [
      { ext: ".mp3", mimeTypes: ["audio/mpeg"] },
      { ext: ".m4a", mimeTypes: ["audio/mp4", "audio/x-m4a"] },
      { ext: ".wav", mimeTypes: ["audio/wav", "audio/wave"] },
    ],
  },
  {
    id: "text",
    label: "Text",
    extensions: [
      { ext: ".txt", mimeTypes: ["text/plain"] },
      { ext: ".csv", mimeTypes: ["text/csv"] },
      { ext: ".html", mimeTypes: ["text/html"] },
      { ext: ".xml", mimeTypes: ["application/xml", "text/xml"] },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    extensions: [
      { ext: ".pdf", mimeTypes: ["application/pdf"] },
      { ext: ".doc", mimeTypes: ["application/msword"] },
      {
        ext: ".docx",
        mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      },
      { ext: ".xls", mimeTypes: ["application/vnd.ms-excel"] },
      {
        ext: ".xlsx",
        mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      },
      { ext: ".ppt", mimeTypes: ["application/vnd.ms-powerpoint"] },
      {
        ext: ".pptx",
        mimeTypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
      },
      { ext: ".zip", mimeTypes: ["application/zip"] },
      { ext: ".rar", mimeTypes: ["application/vnd.rar"] },
      { ext: ".json", mimeTypes: ["application/json"] },
      { ext: ".gzip", mimeTypes: ["application/gzip"] },
      { ext: ".odt", mimeTypes: ["application/vnd.oasis.opendocument.text"] },
    ],
  },
];

export const DEFAULT_MAX_FILE_SIZE_MB = 10;

// Flat ext → mimeTypes (merged across categories — extensions are unique here).
const MIME_BY_EXT = new Map<string, string[]>(
  FILE_CATEGORIES.flatMap((c) => c.extensions).map((e) => [e.ext, e.mimeTypes]),
);

// Every extension token, used as the "all files allowed" accept/selection baseline.
export const ALL_FILE_EXTENSIONS = [...MIME_BY_EXT.keys()];

// New file-upload fields start image-only; users widen via the "Allowed files" menu.
export const DEFAULT_FILE_UPLOAD_EXTENSIONS =
  FILE_CATEGORIES.find((c) => c.id === "image")?.extensions.map((e) => e.ext) ?? [];

// Legacy category ids (single-category model) → extensions, so forms saved before the flat
// model still resolve. Old `allowedFileExtensions` held subtype ids ("jpeg") not "."-extensions.
const LEGACY_CATEGORY_EXTENSIONS: Record<string, string[]> = {
  images: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  documents: [".pdf", ".doc", ".docx", ".txt"],
  spreadsheets: [".xlsx", ".xls", ".csv"],
};

/** Effective allowed extensions for a node — nothing configured ⇒ the image-only default.
 * Accepts the new flat list (entries start with ".") and degrades gracefully for legacy
 * single-category data. */
export const resolveAllowedExtensions = (
  allowedFileTypes: unknown,
  allowedFileExtensions: unknown,
): string[] => {
  const list = Array.isArray(allowedFileExtensions)
    ? allowedFileExtensions.filter((e): e is string => typeof e === "string")
    : [];
  const flat = list.filter((e) => e.startsWith("."));
  if (flat.length > 0) return [...new Set(flat)];
  // Legacy: a single category id (+ optional subtype ids we can no longer map) ⇒ whole category.
  if (typeof allowedFileTypes === "string" && allowedFileTypes in LEGACY_CATEGORY_EXTENSIONS) {
    return LEGACY_CATEGORY_EXTENSIONS[allowedFileTypes];
  }
  return DEFAULT_FILE_UPLOAD_EXTENSIONS;
};

/** HTML `accept` string (MIME + extension tokens) for the picker, `useFileUpload`, and server-side
 * validation. Empty selection ⇒ the full catalog (all supported files). */
export const buildAcceptFromExtensions = (extensions: string[]): string => {
  const exts = extensions.length > 0 ? extensions : ALL_FILE_EXTENSIONS;
  const tokens = new Set<string>();
  for (const ext of exts) {
    tokens.add(ext);
    for (const mime of MIME_BY_EXT.get(ext) ?? []) tokens.add(mime);
  }
  return [...tokens].join(",");
};

// Non-canonical MIME aliases that browsers/legacy uploads still emit.
const MIME_EXT_ALIASES: Record<string, string> = {
  "image/jpg": "jpg",
  "application/csv": "csv",
};

const EXT_BY_MIME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const { ext, mimeTypes } of FILE_CATEGORIES.flatMap((c) => c.extensions)) {
    const bare = ext.replace(/^\./, "");
    for (const mime of mimeTypes) {
      if (!(mime in map)) map[mime] = bare;
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
