---
status: accepted
date: 2026-05-13
---

# Form Short IDs in place of UUIDs on public URLs

## Context

The public form URL used the Form's primary-key UUID (`/forms/<UUID>`), producing 47-character paths like `/forms/71136b40-6d49-4052-a3eb-3fd7c91882df`. The UUID also leaked into the embed snippet's `data-form-id` attribute, the embed-metadata API path, and the OG-image URL — i.e. every public surface where a Form is addressed by identifier. The motivation was twofold: shorten the shareable URL, and stop exposing the internal primary key on public surfaces.

## Decision

Introduce `forms.shortId text not null unique` — a 7-character, base62 (`a-zA-Z0-9`), globally-unique, system-generated, immutable identifier — and replace the UUID with this `shortId` on every public surface. Internal joins, foreign keys, server logs, and authenticated-app URLs continue to use the UUID.

Concretely:

- **Generation**: `nanoid` with a custom base62 alphabet, length 7. Inside a retry-on-collision loop bounded to 5 attempts. Allocated at Form-creation time, inside the same transaction that inserts the Form row.
- **Storage**: new `shortId` column on `forms`, `NOT NULL UNIQUE` from day one. Existing rows backfilled in the same migration.
- **Public URL**: the existing `/forms/$formId` route is retained, but `$formId` is now interpreted as a `shortId`. The route param/file may be renamed to `$shortId` for honesty. UUID-based public URLs do not resolve.
- **Custom-domain coexistence (option β)**: a Form attached to a custom domain resolves at **both** `mycompany.com/<slug>` (preferred, emitted by the share UI and set as `<link rel="canonical">`) and `reform.com/forms/<shortId>` (permanent fallback). The shortId URL keeps working if the custom domain is later removed or suspended.
- **Public-surface boundary**: shortId fully replaces UUID in the public URL, embed `data-form-id`, `/api/forms/<shortId>/meta`, and `/api/og/<shortId>/<hash>`. UUID is reserved for internal use only.
- **Mutability**: immutable for v1. No regenerate, no user-editable vanity. (Vanity URLs remain available on custom-domain hosting via the existing `forms.slug` per-domain field.)
- **Profanity filter**: none. Accept the rare bad-looking output (~1 in tens of thousands) rather than ship a blacklist.

## Considered Options

**Generator: `nanoid` vs `@paralleldrive/cuid2`.**
Cuid2 markets itself as more secure (timestamp + counter + host fingerprint mixed via SHA3) and is base36 lowercase by default. Rejected because (a) cuid2's threat model (defeating fast-collision attacks, node-cluster seed clashes) is irrelevant for IDs allocated server-side inside a `UNIQUE`-constrained INSERT; (b) base62 mixed case fits the YouTube/Stripe short-id aesthetic and gives 6× the namespace at length 7 (3.5 T vs 57 B); (c) the configurable alphabet keeps future flexibility cheap. The cuid2 advantages (lowercase URLs are friendlier for voice/print) don't apply: Reform forms are shared via clicks, paste, and QR, not by hand-retyping.

**Length: 6 vs 7 vs 8.**
6 base62 = 56.8 B works, but 7 buys 62× more namespace for one extra character — comfortable headroom against future growth, accidental burning of IDs on abandoned drafts, and the (unimplemented but possible) profanity-filter regenerate rate.

**Generation timing: at creation vs at first publish vs lazy on first share.**
At-creation chosen for clean `NOT NULL UNIQUE` schema, no nullability branches in calling code, and zero write-on-read side-effects when opening the Share sidebar. Drafts get a shortId immediately even though the public URL still 404s until publish — the share UI already gates the URL footer on `!isDraft`.

**Public-surface scope: shortId in URL only vs shortId everywhere public vs accept both.**
"Everywhere public" chosen because half-fixing the UUID leak (leaving it in embed snippets and OG image URLs) doesn't address the original concern — anyone right-clicking _View Page Source_ on an embedding site would still see the UUID. "Accept both" was rejected as a permanent tax on every endpoint with no migration benefit pre-prod.

**Custom-domain coexistence: redirect vs dual-canonical vs only-custom.**
Dual-canonical (β) chosen because custom domains are revocable (DNS lapses, plan downgrades suspend domains): if the shortId URL also stopped working when a domain went away, every previously-shared link would break from a transient state. The shortId URL acts as a permanent fallback; the custom-domain URL is preferred via the share UI and `<link rel="canonical">`.

**Mutability: immutable vs regenerate vs editable vanity.**
Immutable chosen because mutability invalidates QR codes, embed snippets, link previews, paper flyers, and pasted-in-Slack links — every regenerate becomes a "did you remember to update everywhere?" moment for a value the user never had to pick. Vanity URLs are already covered by the per-custom-domain `slug` field; if a Free-plan vanity feature is wanted later, the immutability constraint can be relaxed without schema changes.

## Consequences

- The promise to users: **the shortId in `forms.shortId` is forever.** Once assigned, it sticks for the life of the Form. Hard-deletes free the value back to the namespace; soft-deletes (archived status) keep it reserved.
- The mental model for future contributors: **UUID is internal; shortId is public.** Joins, foreign keys, server logs, and `/_authenticated/workspace/*` URLs use UUID. Public URLs, embeds, OG images, and the meta-fetch API use shortId. Mixing them is a code-review red flag.
- The orphan route `/forms/$i8n/$formId` is deleted alongside the migration. It has been dead since shortly after its addition (no callers, the `$i8n` segment was never read by the body).
- The legacy UUID-based public URL stops resolving. We are pre-prod, so no migration grace period is needed. Post-prod, a separate 301-redirect compatibility layer can be added if real legacy URLs exist.
- Pre-prod backfill ships in the same migration that adds the column (production-shaped from day one) so the same migration is safe to run later against a populated database.
- The shortId is non-enumerable (`nanoid` uses CSPRNG, no sequence leakage) but is not a secret. Treat it like a YouTube video ID: anyone with it can hit the public form, the same way they could with the share URL. Sensitive forms remain protected by the existing password-gate and plan-gated visibility controls — not by URL obscurity.
