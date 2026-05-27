// Local `createError` — mirrors evlog's shape but avoids importing "evlog",
// whose entry pulls server-only modules that contaminate the client bundle.
//
// Structurally compatible with `EvlogError`:
// - name === "EvlogError" so evlog's Nitro v3 pipeline emits the structured
//   `{ data: { code, why, fix, link } }` envelope (gates on name).
// - statusCode/statusText/statusMessage aliases for h3/ofetch.
// - `get data()` builds evlog's HTTP envelope; toJSON() matches evlog's shape.
// - `internal` non-enumerable server-only context (stripped by toJSON).
//
// Caveat: TanStack Start's seroval ShallowErrorPlugin keeps only Error.message.
// Structured fields cross via evlog's HTTP envelope (FetchError-shaped), NOT
// seroval — so `parseError().code` works on server-fn responses, NOT across RSC.
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
    // Name = "EvlogError" so Nitro v3 errorHandler emits the structured
    // envelope, not a generic 500.
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
        // configurable so augmenting middleware can re-attach context.
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

  // Envelope read by Nitro v3 serializer; client `parseError` unwraps via `data.data`.
  get data(): StructuredErrorData {
    return {
      code: this.code,
      ...(this.why && { why: this.why }),
      ...(this.fix && { fix: this.fix }),
      ...(this.link && { link: this.link }),
    };
  }

  // Backend-only context via getter so `'internal' in err` is true (evlog drain
  // detects via `in`). Stripped from toJSON.
  get internal(): Record<string, unknown> | undefined {
    return (this as unknown as { [INTERNAL_SYMBOL]?: Record<string, unknown> })[INTERNAL_SYMBOL];
  }

  // Mirrors EvlogError.toJSON — `internal` omitted (server-only).
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
