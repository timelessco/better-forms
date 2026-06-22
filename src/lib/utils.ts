import { log } from "evlog";

export { cn } from "cnfast";

/** Clamp `value` into the inclusive [min, max] range. */
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Parse timestamp from DB as UTC. Postgres returns "YYYY-MM-DD HH:mm:ss" without timezone; treat as UTC. */
export const parseTimestampAsUTC = (value: string | undefined): Date | null => {
  if (!value) return null;
  if (value.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(value)) return new Date(value);
  return new Date(value.replace(" ", "T") + "Z");
};

/** Fallback sprite icon name when no icon is set */
export const DEFAULT_ICON_NAME = "file-06";

/** Matches `#rgb` and `#rrggbb`. Use `HEX_COLOR_WITH_ALPHA_RE` for 8-digit variants. */
const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}){1,2}$/;
export const isHexColor = (str: string): boolean => HEX_COLOR_RE.test(str);

/** Check if a string is a valid URL (absolute, relative path, blob, or data URI) */
export const isValidUrl = (str: string): boolean => {
  if (!str) return false;
  try {
    const _url = new URL(str);
    return Boolean(_url);
  } catch {
    return (
      str.startsWith("/") ||
      str.startsWith("http") ||
      str.startsWith("blob:") ||
      str.startsWith("data:")
    );
  }
};

// Diagnostic helper via evlog debug. `log.debug` calls are stripped from prod
// by `evlog/vite` (`strip: ['debug']`) → no-op in prod. Don't drop that strip
// without an `import.meta.env.PROD` guard, or 45+ call sites flood prod logs.
// Inputs:
//   logger("[tag]")           → { tag: "[tag]" }
//   logger("[tag]", data)     → { tag: "[tag]", data }
//   logger("[tag]", a, b, c)  → { tag: "[tag]", data: [a, b, c] }
//   logger({ ... })           → passes the object through directly
export const logger = (...args: unknown[]): void => {
  if (args.length === 0) return;
  const [first, ...rest] = args;
  if (typeof first === "string") {
    log.debug({
      tag: first,
      ...(rest.length > 0 && { data: rest.length === 1 ? rest[0] : rest }),
    });
    return;
  }
  log.debug(first as Record<string, unknown>);
};

export const isNullable = (value: unknown): value is null | undefined => value == null;
