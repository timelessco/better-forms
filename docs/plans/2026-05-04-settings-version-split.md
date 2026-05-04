# Split Settings out of Version History + Header CTA Rework

**Goal:** Two problems, one delivery:

1. Stop versioning behavioral settings. Version history holds only editor + customization snapshots; settings live in a separate draft → live pipeline that publishes alongside (or independently of) versions.
2. Stop letting the header's primary CTA fire **Publish** when the user's intent is **Edit**. Outside the editor route, the CTA is always Edit; inside the editor, Publish stays primary but only via a confirmation popup that lists exactly what's about to go live.

These ship together because the header rework needs the per-domain dirty flags from problem 1 (`hasVersionedChanges`, `hasSettingsChanges`) to drive the dirty-dot tooltip, and the confirmation popup needs the per-domain deltas from problem 1 to render its summary. Splitting them into two PRs would double the test surface and leave the header in a temporary half-state.

**Why problem 1:** Today, every change — including settings toggles — counts as an unpublished change and feeds the same version history. This conflates two distinct kinds of edits:

- **Versioned** (editor structure, theme/customization): users want to compare, revert, and inspect across snapshots.
- **Live toggles** (notifications, redirects, integration flags): users just flip them; comparing across versions is noise, not signal.

It also breaks down at the UI layer: the version-history sidebar competes for the same slot as the settings sidebar, so when a version is selected the user can't open settings to see what differs. Pulling settings out of versioning resolves both problems.

**Why problem 2:** The header has one button slot that flips between **Edit** (outside the editor, no pending changes) and **Publish** (inside the editor, OR anywhere there are unpublished changes). When a user makes a settings change from the submissions page, comes back hours later, and sees a Publish button, they have no path into the editor to inspect what's pending — clicking the button publishes; not clicking leaves them stuck. The CTA must always match user intent: outside the editor, the only intent that makes sense is "let me see what's going on" → Edit.

---

## Locked decisions

1. **Versioning scope:** every published version snapshots `editor` + `customization` only. Settings are never in a version.
2. **Reverting a version** restores `editor` + `customization` to that snapshot. `formSettings` (live) is untouched.
3. **Schema split:**
   - `formSettings` — new table, one row per form, holds the **live** settings used by the published renderer.
   - `form.draftSettings` — column on `form`, holds the working draft. Diffed against `formSettings` to detect pending settings changes.
4. **Publish is per-domain conditional.** Versioned-only changes create a new version, no settings write. Settings-only changes copy `draftSettings → formSettings`, no new version. Both: both, in one transaction.
5. **Preview** uses `draftSettings` (preview = "what publish will produce").
6. **`hasUnpublishedChanges`** lights up if either source is dirty: versioned draft ≠ last version, OR `draftSettings` ≠ `formSettings`. See §3 below.
7. **Discard changes** resets both: `editor`/`customization` to last version, `draftSettings` to live `formSettings`. One click returns the form to its published state.
8. **Version-history change summary** shows only Editor + Customization deltas with per-line Revert. Settings deltas surface in a separate place (publish-confirmation popup; small badge on Edit button outside the editor).
9. **No audit log for settings.** Out of scope.
10. **First publish ever:** both flags are dirty by definition (no baseline). First Publish click creates the initial version row AND the initial `formSettings` row.
11. **Header CTA rule:** outside the edit route the primary CTA is always **Edit** — it never publishes. Publish only exists inside the edit route, and clicking it always opens the confirmation popup before writing anything.
12. **Dirty indicator on Edit:** when the user is outside the edit route and `hasAnyChanges` is true, the Edit button shows a small dot. Tooltip text is driven by the two granular flags: editor-only / settings-only / both.
13. **Confirmation popup is gating, not informational.** Clicking Publish never writes directly — it always opens the popup, even when only one domain is dirty. The popup's Publish button is the actual write trigger.

---

## What already exists (do not recreate)

- `useHasUnpublishedChanges(formId)` — current single-boolean hook gating Publish.
- `publishForm(formId)` / `discardChanges(formId)` — current publish/discard transactions.
- `lastPublishedVersionId` on `form` — versioned-side baseline.
- Version-history sidebar UI shell — content/summary needs reshaping but the sidebar slot stays.
- `MinimalColorPicker` (just-shipped) — orthogonal but mentioned because customization edits feed it.
- `AppHeader` (`src/components/ui/app-header.tsx`) — the existing Publish/Edit branch lives here (around the `isEditRoute || hasUnpublishedChanges` ternary). The dirty-dot, popup wiring, and CTA-rule change happen inside this file; no new header component.
- `AlertDialog` primitives already in use in `AppHeader` for the existing delete/discard dialogs — reuse for the publish-confirmation popup.

---

## What this plan delivers

### 1. Schema (`src/db/schema.ts`)

- New table `formSettings`:
  - `formId` (PK, FK → form, on delete cascade)
  - all current settings fields (move from wherever they currently sit on `form`)
  - `updatedAt`
- New column `form.draftSettings` (JSONB), nullable. Mirrors the shape of `formSettings` rows.
- Migration: for every existing form, populate `formSettings` from the current settings blob, copy the same blob to `form.draftSettings`. Forms with no settings → null draft, no `formSettings` row.

> **Decision needed up front:** which fields are "settings" (move) vs "customization" (stay versioned). Walk every key in the current settings/customization shape and label each. Add the labeled list to `CONTEXT.md`. Don't rename any user-facing labels in this pass (per user instruction).

### 2. Read/write layer

- New live hook `useFormPublishStatus(formId)` returning:
  ```ts
  {
    hasVersionedChanges: boolean,
    hasSettingsChanges: boolean,
    hasAnyChanges: boolean,         // = A || B; replaces useHasUnpublishedChanges
    versionedDelta: VersionedDelta, // for change summary in version history
    settingsDelta: SettingsDelta,   // for publish-confirmation popup
  }
  ```
  Subscribes to: form draft row, last-version row, `formSettings` row.
- Keep `useHasUnpublishedChanges` as a thin alias (`= useFormPublishStatus(...).hasAnyChanges`) until call sites migrate, then remove.
- Update `publishForm(formId)` to be per-domain conditional:
  - If `hasVersionedChanges`: snapshot `editor` + `customization` into a new version row, bump `lastPublishedVersionId`.
  - If `hasSettingsChanges`: upsert `formSettings` from `draftSettings`.
  - Both branches independent; either or both run in a single transaction.
- Update `discardChanges(formId)`:
  - Reset `editor` + `customization` from the last version (current behavior).
  - Reset `draftSettings` from `formSettings`.

### 3. `hasUnpublishedChanges` decomposition (detail)

Two independent dirty sources, OR'd together:

| Source        | Compare                                                                           | Notes                                                                    |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A — versioned | `form.editor` + `form.customization` against snapshot at `lastPublishedVersionId` | If `lastPublishedVersionId` is null → any non-empty draft is dirty.      |
| B — settings  | `form.draftSettings` against matching `formSettings` row                          | If no `formSettings` row yet → any non-default `draftSettings` is dirty. |

Edge cases to implement:

- **Settings changed, then reverted to live values.** Diff must report no change — no "ever-dirty" flag, only current vs. live.
- **Big editor JSON.** Don't regress to full deep-equal on every keystroke. Reuse whatever hashing/dirty-tracking the current `useHasUnpublishedChanges` does.
- **Preview mode.** Preview uses `draftSettings`, but that does **not** affect dirty state — dirty is "live ≠ draft", not "preview ≠ live".

### 4. Publish-confirmation popup

Triggered on Publish click whenever `hasAnyChanges` is true. Lists changes per domain:

- **Editor:** _"3 blocks changed"_ (use `versionedDelta`)
- **Customization:** _"primary color blue → green"_ (use `versionedDelta`)
- **Settings:** _"redirect URL, 2 fields required"_ (use `settingsDelta`)

Buttons: Cancel / Publish. This is the **only** surface where pending settings changes are visible — version history won't show them.

### 5. Version-history change summary

Each version entry gets an inline summary grouped by domain (Editor + Customization only) with per-line Revert. Per-line revert mutates the _current draft_ only — it doesn't touch live until the user clicks Publish, matching #7.

### 6. App-header CTA rework (`src/components/ui/app-header.tsx`)

The current `{isEditRoute || hasUnpublishedChanges ? <Publish/> : <Edit/>}` branch is the bug — `hasUnpublishedChanges` should never override the user's location. Replace with:

| Location           | `hasAnyChanges` | Rendered CTA                                            |
| ------------------ | --------------- | ------------------------------------------------------- |
| outside edit route | false           | **Edit** (link to edit route, no dot)                   |
| outside edit route | true            | **Edit** (link to edit route, with dirty dot + tooltip) |
| inside edit route  | false           | **Published** (disabled, current behavior)              |
| inside edit route  | true            | **Publish** (enabled; click opens confirmation popup)   |

**Dirty-dot rendering.** A 6px dot positioned top-right of the Edit button. Tooltip resolves from the two granular flags:

- `hasVersionedChanges && !hasSettingsChanges` → _"Editor changes pending"_
- `!hasVersionedChanges && hasSettingsChanges` → _"Setting changes pending"_
- both → _"Editor and setting changes pending"_

**Click behavior.** Edit is a `Link` (no async work, no popup). Publish opens the popup from §4 — never writes directly, even when only one domain is dirty (per locked decision #13). The popup's Publish button calls the conditional `publishForm` from §2.

**Discard button.** Current `RotateCcwIcon` button stays in the header but its tooltip and confirmation copy update to reflect the broader scope: "Reset editor, customization, and settings to last published state."

**Hotkey.** `HOTKEYS.PUBLISH_FORM` currently fires `handlePublish` directly. Update to open the popup instead — same gate applies whether the trigger is mouse or keyboard. The hotkey stays enabled by `isFormBuilder && (isEditRoute || hasUnpublishedChanges) && !isPublishing` only when _inside_ the edit route now, since the CTA outside is no longer Publish:

```ts
useHotkey(HOTKEYS.PUBLISH_FORM, openPublishPopup, {
  enabled: isFormBuilder && isEditRoute && hasAnyChanges && !isPublishing,
});
```

**Mobile menu.** The "Discard changes" and "Delete form" entries in `menuItems` stay as-is. No new entries needed — Edit is reachable via the breadcrumb/CTA on every screen.

---

## Open questions

- **Where does the per-domain split live?** Single labeled list in `CONTEXT.md` is the cheapest place. If it grows beyond ~30 fields, consider extracting a typed `FORM_SETTINGS_FIELDS` const that the migration, dirty-diff, and confirmation popup all read from — single source of truth for "what is a setting."
- **Concurrent edits.** Two browsers editing the same form: today, last-write-wins on the form row. With settings split out, two browsers editing settings still last-write-wins on `form.draftSettings`. No new conflicts introduced; flagging in case stricter behavior is wanted later.
- **Revert + dirty.** After clicking per-line Revert in version history, the draft now differs from the last version → versioned dirty flag goes true. Confirm this is the intended behavior (it is the natural read of #7, but worth stating).

---

## Test plan

**Data layer**

- Publish with versioned changes only → new version row, `formSettings` untouched.
- Publish with settings changes only → `formSettings` updated, no new version row.
- Publish with both → one transaction, both written.
- Discard → both sides reset.
- Toggle a setting then toggle back → `hasSettingsChanges` returns false.
- Revert old version → `editor`/`customization` change, `formSettings` unchanged.
- First publish ever → creates version row + `formSettings` row in one transaction.
- `useFormPublishStatus` reactivity: form draft change updates `hasVersionedChanges`; live `formSettings` row update updates `hasSettingsChanges` independently.

**Header CTA**

- On submissions route with no pending changes → Edit button visible, no dot, links to edit route.
- On submissions route with versioned-only changes → Edit button + dot, tooltip says "Editor changes pending"; clicking navigates to edit route, does not publish.
- On submissions route with settings-only changes → Edit button + dot, tooltip says "Setting changes pending"; clicking navigates to edit route, does not publish.
- On submissions route with both → tooltip says "Editor and setting changes pending".
- On edit route with no changes → "Published" disabled button (current behavior preserved).
- On edit route with any changes → Publish button enabled; click opens popup; popup lists per-domain deltas; popup Cancel does not write; popup Publish performs the conditional write from §2.
- `HOTKEYS.PUBLISH_FORM` on edit route opens popup (does not publish directly); on submissions route the hotkey is disabled.
- Discard-confirmation copy reflects the broader scope (editor + customization + settings).
