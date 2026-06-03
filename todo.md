# Reform — TODO

Cleanup punch list seeded by `/grill-with-docs`. New entries link back to `CONTEXT.md` → "Flagged ambiguities" where applicable.

_All items from the original session are resolved as of 2026-04-30. Add new ones below as they surface._

## Type tightening

- [ ] **Strictly type `FormListing.content` and `forms.content` as Plate `Value`.**
      Currently `FormListing.content?: unknown[]` and the DB column is `jsonb()` (untyped). Consumers cast to `Value` from `platejs` at every read site (e.g. `preview-mode.tsx:34` does `(doc?.content as Value)`). After typing, that cast disappears and the editor/preview path is fully type-safe end-to-end.
      _Touches:_ `src/db/schema.ts` (`content: jsonb().$type<Value>()...`), `src/collections/query/form-listing.ts` (`content?: Value`), all `as Value` cast sites under `src/components/form-components/`, `src/routes/forms/`, `src/routes/_authenticated/workspace/...`. Also consider doing the same for `customization` (`Record<string, string>`) and any other untyped JSONB columns left.

## Slash command — fields to implement

Source of truth: Figma `system-flat` → `dropdown` node `25434:3120`. The slash menu
(`src/components/ui/slash-node.tsx`) now lists **every** option from the design, in the
design's order. Items below appear in the menu but are **disabled** until their insert +
render behaviour is built.

### Questions

- [x] **Dropdown** — single-select dropdown field (slash value `formDropdown`; `formOptionItem` variant `dropdown`). Editor reuses option rows; preview renders a single-select popover; "Shuffle options" toggle in the block context menu.
- [ ] **Linear scale** — numeric scale / slider field (value `linearScale`).
- [ ] **Matrix** — rows × columns grid question (value `matrix`).
- [ ] **Rating** — star rating field (value `rating`).
- [ ] **Payment** — collect a payment (value `payment`).
- [ ] **Signature** — draw/capture a signature (value `signature`).
- [ ] **Wallet connect** — connect a crypto wallet (value `walletConnect`).

### Layout blocks

- [ ] **Divider** — horizontal rule (value `divider`). Wire to `KEYS.hr` once the hr plugin is confirmed registered, or add a dedicated block.
- [ ] **Title** — form title block (value `title`).
- [ ] **Label** — standalone field label (value `label`).

### Advanced blocks

- [ ] **Calculated fields** — compute a value from other answers (value `calculatedFields`).
- [ ] **Hidden fields** — store data hidden from respondents, e.g. UTM/metadata (value `hiddenFields`).
- [ ] **reCAPTCHA** — spam/bot protection (value `recaptcha`).
- [ ] **Respondent's country** — auto-detect respondent country (value `respondentCountry`).

_Already implemented (enabled):_ Short answer, Long answer, Multiple choice, Checkboxes,
Dropdown, Multi-select, Number, Email, Phone number, File upload, Date, Time, Ranking, New page,
Text, Heading 1/2/3, Image, Video, Audio, Embed Anything, Conditional logic.

_To enable a field:_ add its `insertBlockMap` handler in `src/components/editor/transforms.ts`,
register the rendering node/plugin, then drop `disabled: true` from its entry in
`slash-node.tsx`. Disabled rendering is handled by the `disabled` prop on `InlineComboboxItem`
(`src/components/ui/inline-combobox.tsx`).
