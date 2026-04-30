# Reform — Domain Context

Reform is a form builder. Authenticated users in an **Organization** create **Forms** inside **Workspaces**, publish immutable **Versions**, and collect **Submissions** from anonymous respondents.

This document records the canonical vocabulary used across the codebase. When writing code, issues, or PRs, use these terms — not synonyms.

## Language

### Product nouns

**Workspace**:
An org-scoped container that groups **Forms**. The DB table is `workspaces`. User-facing label is "Workspace" throughout; the default name on creation is `"New Workspace"`.
_Avoid_: Folder, Project, Collection (reserved — see below)

**Form**:
The mutable working entity — a row in the `forms` table. Holds current editor content (`content`), settings, customization, title, icon, cover, and a `status` of `'draft' | 'published' | 'archived'`. Lives in a Workspace. The Form is what you edit; it is **not** what Form-fillers actually fill out.
_Avoid_: Survey, Document

**Form Version**:
An immutable published snapshot of a Form — a row in the `formVersions` table. Numbered (v1, v2, …) and tagged with `publishedByUserId` / `publishedAt`. Submissions reference a Form Version, not a Form, so submission data is always validated against the schema as it was at publish time.
_Avoid_: Snapshot (too generic), Revision

**Publish** (verb):
The act of creating a new **Form Version** from the current **Form** state. Bumps the version number. Sets `forms.lastPublishedVersionId` to the new Form Version.
_Avoid_: Release, Push live, Ship

**Live Version**:
The Form Version currently served at the public form URL — i.e. `forms.lastPublishedVersionId`. Distinguishes the in-flight Form (editor working copy) from the immutable snapshot Form-fillers actually interact with. Use this term in code and dev discussion when precision matters; user-facing UI strings may use the looser "published form".

**Form Status** (`forms.status`):
The lifecycle state of a Form. One of:

- **Draft** — never been published, or published once and then reverted to draft. Form Versions may be 0 or more. Public URL 404s. No new Submissions accepted.
- **Published** — public URL serves the **Live Version**. New Submissions accepted; file uploads allowed.
- **Archived** — soft-deleted by a User. Hidden from default form listings (a separate lazy query loads them in the archive UI). Public URL 404s. New Submissions and file uploads rejected. Existing Submissions and Form Versions preserved. Notifications stop generating. Reversible (an Archived Form can be restored to Draft or Published from the delete dialog).

Transitions: any status can move to any other. Drafts can be archived directly without ever publishing. Hard-delete may eventually purge an Archived Form.

**Block**:
The native primitive of the Plate.js editor — any node in `forms.content`. Includes both content blocks (heading, paragraph, image) and answerable blocks. Use this term when talking about editor structure, layout, or rendering.
_Avoid_: Element, Node (Plate-internal), Section

**Question**:
An _answerable_ **Block** — a block that prompts the respondent for input (short text, long text, choice, file upload, etc.). Every Question is a Block; not every Block is a Question. Analytics tables (`formQuestionProgress`, `formDropoffDaily`) track Questions, not Blocks.
_Avoid_: Field, Input

**Answer**:
A single respondent's value for one **Question**, stored as a key in `submissions.data`. Synonym used in code: "user-submission" (a single answer entry).
_Avoid_: Response, Value, Entry

**Step**:
A discrete screen a Respondent navigates between when filling a multi-step Form. Has a 0-based index, tracked in `submissions.lastStepReached`. **Not** a Plate Block type — it is a logical grouping derived at runtime from the Form's content and Presentation Mode.
_Avoid_: Page (overloads with web pages), Section

**Page Break**:
A Plate Block (`type: "pageBreak"`) inserted by the Form author to separate **Steps** in `card` Presentation Mode. Ignored in `field-by-field` mode.
_Avoid_: Divider, Separator

**Thank You Page**:
The final **Step**, rendered after Submit. Marked by a Page Break Block with `isThankYouPage = true`. Has its own slash-menu entry (`pageBreakThankYou`).
_Avoid_: Confirmation, End screen, Success page

**Presentation Mode**:
How a Form's Steps are rendered to the Respondent. Stored on `forms.presentationMode`. Modes:

- **`card`** — one Step per Page-Break-separated section. Author controls grouping. (Default.)
- **`field-by-field`** — one Step per Question, auto-generated. Page Breaks ignored.
- **`ai-chat`** — planned (see `docs/plans/2026-04-27-ai-chat-presentation-mode.md`).

**Multi-step (Form)**:
Adjective. A Form whose total Step count is greater than 1. Always derived at runtime — either via `totalSteps > 1` from the Step derivation, or via a Plate selector that checks for any `pageBreak` block. There is no stored `isMultiStep` field on the Form.

**Settings**:
The _behavioral_ configuration of a Form — privacy, redirect, notifications, submission limits, presentation mode, language, close date, branding, analytics, etc. Stored as a single typed group on `forms.settings` JSONB. The canonical TS type is `FormSettings`; a public-safe subset is `PublicFormSettings` (snapshotted into `formVersions.settings` at publish time). Says **how the Form behaves**.
_Avoid_: Config, Options

**Customization**:
The _visual_ theme of a Form — color tokens, fonts, layout sizes, custom CSS, light/dark mode, style preset (vega/nova/maia/lyra/mira/custom). Stored as `forms.customization` JSONB, a flat `Record<string, string>`. Says **how the Form looks**.
_Avoid_: Theme (informal alias OK), Style, Skin

**Branding**:
The Reform application logo shown on a published Form. Controlled by `forms.branding` (default `true` — branding is shown). A User can disable it only on a paid **Plan**. Distinct from **Customization** — branding is whether _Reform's_ mark appears, not how the Form itself looks.

### Plan / billing

**Plan**:
The subscription tier of an **Organization**. One of **Free**, **Pro**, **Business** (matching DB enum literals `"free" | "pro" | "business"`). Stored on `organization.plan` (default `"free"`); cached from Polar via webhooks. Org-scoped, not user-scoped.
_Avoid_: Tier, Subscription (reserved for the Polar billing concept — see below)

**Free Plan / Pro Plan / Business Plan**:
The three named tiers. Free is the default; Pro and Business are paid.

**Paid Plan**:
Adjective shorthand for any non-Free Plan (Pro or Business). Use when feature gating is binary rather than per-tier.

**Subscription**:
The Polar billing object backing a paid Plan. Has its own product IDs and lifecycle (created, active, canceled, revoked, updated, uncanceled). Not the same as a Plan — multiple Polar products can map to one Plan (e.g. `pro` and `proYearly` are two billing cadences of the **Pro Plan**).

**Upgrade / Downgrade**:
Verbs for transitioning between Plans. Driven by Polar Subscription events; webhook handlers (`src/lib/auth/polar-handlers.server.ts`) update `organization.plan`.

**Plan-gated feature**:
A feature available only on a specific Plan (or any Paid Plan). Defined in `src/lib/config/plan-gates.ts` as a `FeatureGate` literal mapped to its minimum Plan in `PLAN_GATES`. Gate sites call `planUnlocks(plan, feature)` rather than comparing plan strings directly. Current gates: `analytics`, `customDomains`, `respondentEmailNotifications`, `dataRetention`, `disableBranding`, `customization`.

**Submission**:
A row in the `submissions` table representing one respondent's session of answers for a **Form**. Always called a Submission regardless of state.
_Avoid_: Response, Entry, Result

**Incomplete** (Submission state):
A **Submission** with `isCompleted = false`. Created by autosave; keyed by client-generated `draftId` and upserted on `(formId, draftId)`. Use as an adjective ("incomplete submission"), not a standalone noun. Pairs with **Completed**.
_Avoid_: Draft (reserved for Forms), Partial, In-progress

**Completed** (Submission state):
A **Submission** with `isCompleted = true`. The respondent finalized the form; the row passed full validation against the published Form Version's schema. Pairs with **Incomplete**.
_Avoid_: Final, Submitted (as adjective)

**Submit** (verb):
The act of finalizing a Submission — transitioning Incomplete → Completed. Autosave is **not** "submitting"; it is "saving an incomplete submission".

### Roles

These describe the two distinct populations that interact with a Form. They are **not** interchangeable.

**User**:
An authenticated platform user — a row in the `user` table (Better Auth). Creates Forms, owns Workspaces, belongs to an Organization via `member`. Reserved exclusively for this population.
_Avoid_ using "User" to mean a Visitor, Respondent, or Submitter.

**Visitor**:
Anyone who loaded a public Form URL. Anonymous; identified by `visitorHash` in `formVisits`. Counted as `uniqueVisitors` in analytics.

**Respondent**:
A Visitor who started filling the Form (`formVisits.didStartForm = true`). Owns the Submission row while it is in Incomplete state. Used in user-facing copy (e.g. "Respondent email notifications").

**Submitter**:
A Respondent whose Submission reached the Completed state (`formVisits.didSubmit = true`). Counted as `uniqueSubmitters` in analytics.

**Form-filler** (umbrella):
Role-agnostic term for any of Visitor / Respondent / Submitter when funnel stage is irrelevant.

A logged-in **User** may also act as a Form-filler (e.g. testing their own form). The authenticated identity does not change the funnel role.

### Technical / dev terms

**Collection**:
A TanStack DB client-side reactive data store (`createCollection`). Lives under `src/collections/`. Used for live queries and optimistic mutations. Two variants:

- **Local collection** (`src/collections/local/`) — `localOnlyCollectionOptions`; never syncs to a backend (e.g. `editor-ui`, `form` draft).
- **Query collection** (`src/collections/query/`) — `queryCollectionOptions`; loads from a TanStack Query–backed server fn (e.g. `workspace`, `form-listing`, `submission`, `version`).

_Avoid_ using "Collection" to mean a Workspace or any product-level concept.

## Relationships

- An **Organization** owns many **Workspaces**
- A **Workspace** contains many **Forms**
- A **Form** has zero or more **Form Versions**; the most recent is the **Live Version**
- A **Form** contains many **Blocks**; an answerable Block is a **Question**
- A **Submission** belongs to one **Form Version** (not a Form), and contains one **Answer** per Question
- A **Submission** is owned by a **Respondent** while Incomplete; once Completed, the Respondent becomes a **Submitter**
- The client-side **Collection** layer mirrors server tables to enable optimistic UI; it is not part of the product model exposed to end users.

## Flagged ambiguities

_None currently. Add entries here when terms drift, overload, or contradict — see `/grill-with-docs` skill for format._
