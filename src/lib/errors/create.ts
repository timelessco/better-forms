// Local `createError` — mirrors evlog's `createError` shape but avoids
// importing from "evlog", whose main entry pulls server-only sub-modules
// (`runtime/server/useLogger`) that contaminate the client bundle whenever
// any transitive client import touches a server-fn file at the top level.
//
// Structurally compatible with evlog's `EvlogError`:
// - `name === "EvlogError"` so evlog's Nitro v3 error pipeline recognizes
//   us and emits the structured `{ data: { code, why, fix, link } }`
//   response envelope (`serializeEvlogErrorResponse` gates on the name).
// - Aliases `statusCode`/`statusText`/`statusMessage` for h3/ofetch.
// - `get data()` builds the same envelope evlog serializes into HTTP responses.
// - `toJSON()` so `JSON.stringify(err)` produces the same shape as evlog.
// - `internal` is non-enumerable, server-only context (stripped from HTTP
//   responses by `toJSON`).
//
// Caveat re: over-the-wire fields: TanStack Start's default seroval
// `ShallowErrorPlugin` preserves only `Error.message`. Structured fields
// (`code`, `why`, `fix`, `link`) cross the wire via evlog's HTTP response
// envelope path (FetchError-shaped on the client), NOT via seroval. So
// `parseError(err).code` works on errors from server-fn HTTP responses,
// but NOT for errors thrown across React Server Component boundaries.
import type { ErrorCode } from "./codes";

export interface CreateErrorOptions {
  code: ErrorCode | string;
  status?: number;
  message: string;
  why?: string;
  fix?: string;
  link?: string;
  cause?: unknown;
  internal?: Record<string, unknown>;
}

export interface StructuredErrorData {
  code: ErrorCode | string;
  why?: string;
  fix?: string;
  link?: string;
}

const INTERNAL_SYMBOL = Symbol.for("evlog.error.internal");

export class StructuredError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly why?: string;
  readonly fix?: string;
  readonly link?: string;

  constructor(opts: CreateErrorOptions) {
    super(opts.message, { cause: opts.cause });
    // Name matches evlog's EvlogError so evlog's Nitro v3 errorHandler
    // recognizes us via `error.name === "EvlogError"` and emits the
    // structured response envelope instead of a generic 500.
    this.name = "EvlogError";
    this.code = opts.code;
    this.status = opts.status ?? 500;
    if (opts.why) this.why = opts.why;
    if (opts.fix) this.fix = opts.fix;
    if (opts.link) this.link = opts.link;
    if (opts.internal) {
      Object.defineProperty(this, INTERNAL_SYMBOL, {
        value: opts.internal,
        enumerable: false,
        writable: false,
        // configurable:true matches evlog so error-augmenting middleware
        // can re-attach context without throwing.
        configurable: true,
      });
    }
  }

  // Aliases for h3/ofetch/Nitro compatibility — they read these names.
  get statusCode(): number {
    return this.status;
  }
  get statusText(): string {
    return this.message;
  }
  get statusMessage(): string {
    return this.message;
  }

  // Structured envelope evlog's Nitro v3 serializer reads when building
  // the HTTP response. `parseError` on the client unwraps via `data.data`.
  get data(): StructuredErrorData {
    return {
      code: this.code,
      ...(this.why && { why: this.why }),
      ...(this.fix && { fix: this.fix }),
      ...(this.link && { link: this.link }),
    };
  }

  // Backend-only context — exposed via getter so `'internal' in err` is true
  // (evlog's drain pipeline detects via `in` check). Stripped from toJSON.
  get internal(): Record<string, unknown> | undefined {
    return (this as unknown as { [INTERNAL_SYMBOL]?: Record<string, unknown> })[INTERNAL_SYMBOL];
  }

  // Called by evlog's middleware and any framework code that serializes errors.
  // Mirrors EvlogError.toJSON — `internal` deliberately omitted (server-only).
  toJSON(): {
    name: string;
    message: string;
    code: ErrorCode | string;
    status: number;
    data: StructuredErrorData;
    why?: string;
    fix?: string;
    link?: string;
  } {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      data: this.data,
      ...(this.why && { why: this.why }),
      ...(this.fix && { fix: this.fix }),
      ...(this.link && { link: this.link }),
    };
  }
}

export const createError = (opts: CreateErrorOptions): StructuredError => new StructuredError(opts);
