# Reform — TODO

Cleanup punch list seeded by `/grill-with-docs`. New entries link back to `CONTEXT.md` → "Flagged ambiguities" where applicable.

_All items from the original session are resolved as of 2026-04-30. Add new ones below as they surface._

## Type tightening

- [ ] **Strictly type `FormListing.content` and `forms.content` as Plate `Value`.**
      Currently `FormListing.content?: unknown[]` and the DB column is `jsonb()` (untyped). Consumers cast to `Value` from `platejs` at every read site (e.g. `preview-mode.tsx:34` does `(doc?.content as Value)`). After typing, that cast disappears and the editor/preview path is fully type-safe end-to-end.
      _Touches:_ `src/db/schema.ts` (`content: jsonb().$type<Value>()...`), `src/collections/query/form-listing.ts` (`content?: Value`), all `as Value` cast sites under `src/components/form-components/`, `src/routes/forms/`, `src/routes/_authenticated/workspace/...`. Also consider doing the same for `customization` (`Record<string, string>`) and any other untyped JSONB columns left.
