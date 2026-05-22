// Local `parseError` — mirrors evlog's `parseError` shape but avoids
// importing from "evlog", whose main entry pulls server-only sub-modules
// that contaminate the client bundle whenever any transitive client
// import touches a server-fn file at the top level. Server code can
// still use evlog's parseError directly if it wants.
//
// Returns the same shape so existing call sites don't need to change:
//   { message, status?, code?, why?, fix?, link?, raw }
import type { ErrorCode } from "./codes";

export interface ParsedError {
  message: string;
  status?: number;
  code?: ErrorCode | string;
  why?: string;
  fix?: string;
  link?: string;
  raw?: unknown;
}

const pickString = (value: unknown, key: string): string | undefined => {
  if (value && typeof value === "object" && key in value) {
    const x = (value as Record<string, unknown>)[key];
    if (typeof x === "string") return x;
  }
  return undefined;
};

const pickNumber = (value: unknown, key: string): number | undefined => {
  if (value && typeof value === "object" && key in value) {
    const x = (value as Record<string, unknown>)[key];
    if (typeof x === "number") return x;
  }
  return undefined;
};

// FetchError detection: just `data in error` is too eager — AI SDK errors
// or random payload-bearing objects can carry an unrelated `.data` field.
// Require either a status-shaped field on the error/data OR an evlog-style
// envelope (`data.code` is a string).
const looksLikeFetchError = (e: Record<string, unknown>): boolean => {
  if (!("data" in e)) return false;
  if ("statusCode" in e || "status" in e) return true;
  const data = e.data;
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    "statusCode" in d ||
    "status" in d ||
    "statusText" in d ||
    "statusMessage" in d ||
    typeof d.code === "string"
  );
};

export const parseError = (error: unknown): ParsedError => {
  // FetchError-shaped (ofetch carries server payload under `.data`)
  if (error && typeof error === "object" && looksLikeFetchError(error as Record<string, unknown>)) {
    const e = error as Record<string, unknown>;
    const data = (e.data as Record<string, unknown> | undefined) ?? undefined;
    // EvlogError fields may be nested at data.data (when wrapped) or at data.
    const evlogData = ((data?.data ?? data) as Record<string, unknown> | undefined) ?? undefined;

    return {
      message:
        pickString(data, "statusText") ??
        pickString(data, "statusMessage") ??
        pickString(data, "message") ??
        pickString(e, "message") ??
        "An error occurred",
      status:
        pickNumber(data, "status") ??
        pickNumber(data, "statusCode") ??
        pickNumber(e, "status") ??
        pickNumber(e, "statusCode") ??
        500,
      code: pickString(evlogData, "code") ?? pickString(data, "code") ?? pickString(e, "code"),
      why: pickString(evlogData, "why"),
      fix: pickString(evlogData, "fix"),
      link: pickString(evlogData, "link"),
      raw: error,
    };
  }

  if (error instanceof Error) {
    // StructuredError instances (and any other Error carrying these own
    // props) round-trip their structured fields here even when caught
    // in-process (no FetchError wrapper).
    return {
      message: error.message,
      status: pickNumber(error, "status") ?? pickNumber(error, "statusCode"),
      code: pickString(error, "code"),
      why: pickString(error, "why"),
      fix: pickString(error, "fix"),
      link: pickString(error, "link"),
      raw: error,
    };
  }

  return {
    message: String(error),
    status: 500,
    raw: error,
  };
};
