# Reform — TODO

Cleanup punch list seeded by `/grill-with-docs`. New entries link back to `CONTEXT.md` → "Flagged ambiguities" where applicable.

_All items from the original session are resolved as of 2026-04-30. Add new ones below as they surface._

## Share sidebar — settings kept in code but hidden from the redesigned UI

The `system-flat` Share redesign (`share-summary-sidebar.tsx`) intentionally omits some
controls from the new tab UIs. The underlying form fields + embed output are **untouched**, so
nothing breaks — these just have no UI surface until the design team specifies one. Re-surface by
adding a row back to the relevant tab.

- [ ] **Popup position** (`popupPosition`: bottom-right / bottom-left / center). Removed from the
      Popup tab design. Field still flows through `formFieldsToEmbedOptions` → `data-position` and the
      embed loader honors it (defaults to bottom-right). No UI to change it right now.
- [ ] **Popup "Show emoji" on/off toggle.** Replaced by the Emoji **Edit** glyph picker
      (`emojiIcon`). The boolean `emoji` field is left at its default (on); there's no UI to turn the
      bubble emoji off.
- [ ] **`hideOnSubmitDelay`** (auto-close delay after submit). No row in the new Popup design; field
      retained at its default.
- [ ] **Embed (standard) tab** still uses the legacy `PublishedShareBody` (preview + Customise + Pro
      cards). Only the shared footer + a flat "Preferences" (Question layout + progress bar) section
      were added. Full redesign pending.
- [ ] **Popup "After delay" trigger** uses a fixed 3s wait and **"After scrolling"** a fixed 50%
      threshold in `src/embed/lib/bubble.ts` (no `data-delay` / threshold emitted from the UI).
      Expose configurable values if the design calls for them.
- [ ] **Embed tab — Dynamic width + Align left** dropped from the design. `dynamicWidth` / `alignLeft`
      fields are retained (flow through `data-*`) but have no UI to change them.
- [ ] **Embed tab — manual Height** row only appears when **Dynamic height** is off (mirrors the
      Figma hidden-row state). `height` field is otherwise unset from the UI while dynamic height is on.
- [ ] **Question layout + Show progress bar shown on all three tabs.** Per an explicit product call,
      these appear on Embed / Popup / Full Page even though the Embed and Full Page mocks omit them.
      Drop from those two tabs if the mocks are the source of truth.

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
- [x] **Linear scale** — numeric scale field (value `formLinearScale`). Editor renders a button row from `scaleMin`/`scaleMax`/`scaleStep` (default 1–10, step 1); block menu has "Scale" (dual-handle slider, bounds −10..10) + "Scale step" slider submenus; live form is a single-select number-button group storing the picked value as a string.
- [x] **Matrix** — rows × columns grid question (slash value `formMatrix`; void `formMatrix` node). Editor renders an inline editable grid (add/remove rows & columns); block menu has Required / Shuffle options (rows) / Multiple selection (radio↔checkbox per row). Live form answer is a record `rowValue → columnValue` (single) or `columnValue[]` (multiple). _Follow-up:_ submissions table renders the answer as raw JSON — add a matrix-aware cell renderer.
- [x] **Rating** — star rating field (slash value `formRating`, fieldType `Rating`). Void `formRating` node; editor preview + live interactive stars (`RatingStar`); block menu has "Required" + a "Stars count" stepper (1–10, default 5); live form stores the picked star count as a string.
- [ ] **Payment** — collect a payment (value `payment`).
- [x] **Signature** — draw/capture a signature (slash value `formSignature`, fieldType `Signature`). Void `formSignature` node; editor shows a dashed "Sign here" placeholder; live form is a DPR-correct canvas pad (pointer events, theme-colored stroke, quadratic smoothing) with a Clear button, storing a PNG data URL string; block menu has Required only; submissions table renders the signature image.
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
