import * as v from "valibot";

// zod->valibot parity helpers for search-param validators. Valibot has no
// `coerce`, so we replicate `z.coerce.*` with an unknown-input transform.

// z.coerce.boolean(): any present value -> Boolean(value); absent key -> undefined.
const coercedBoolean = v.pipe(
  v.unknown(),
  v.transform((input) => Boolean(input)),
);

/** z.coerce.boolean().optional() */
export const optionalCoercedBoolean = v.optional(coercedBoolean);

/** z.coerce.boolean().optional().default(value) */
export const coercedBooleanWithDefault = (value: boolean) => v.optional(coercedBoolean, value);

/** z.coerce.boolean().catch(value).optional() — catch is inert for Boolean() coercion; kept for parity. */
export const coercedBooleanWithCatch = (value: boolean) =>
  v.optional(v.fallback(coercedBoolean, value));

/** z.coerce.number().catch(fallbackValue).optional() — invalid/NaN -> fallback. */
export const coercedNumberWithCatch = (fallbackValue: number) =>
  v.optional(v.fallback(v.pipe(v.unknown(), v.transform(Number), v.number()), fallbackValue));
