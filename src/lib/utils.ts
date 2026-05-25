import { createIsomorphicFn } from "@tanstack/react-start";
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

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

export const logger = createIsomorphicFn()
  .client((...args: unknown[]) => {
    if (!import.meta.env.PROD) {
      console.log("[Client Log] :", ...args);
    }
  })
  .server((...args: unknown[]) => {
    if (process.env.NODE_ENV === "production") return;
    console.log("[Server Log] :", ...args);
  });

export const isNullable = (value: unknown): value is null | undefined => value == null;
