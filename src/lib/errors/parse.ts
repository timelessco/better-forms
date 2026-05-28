// Local `parseError` — mirrors evlog's shape but avoids importing "evlog"
// (server-only modules contaminate the client bundle). Server may use evlog's
// directly. Same shape: { message, status?, code?, why?, fix?, link?, raw }.
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

// FetchError detection: `data in error` is too eager (AI SDK / random objects
// carry `.data`). Require a status-shaped field OR evlog envelope (string `data.code`).
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
    // StructuredError (+ any Error with these own props) round-trips structured
    // fields here even when caught in-process (no FetchError wrapper).
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
