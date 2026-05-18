---
status: accepted
date: 2026-05-18
---

# Per-Question drop-off analytics across all Presentation Modes

## Context

The v1 analytics implementation (see `docs/plans/2026-04-27-analytics-v1.md`) promised "question-level drop-off" but the runtime only delivers it in the `field-by-field` Presentation Mode. In `card` mode with Page Breaks (multi-step), `formQuestionProgress.questionId` is set to a synthetic `"step_<N>"` with `questionType = null`, so the funnel can only report drop-off **between Steps**, not **within them**. In single-page `card` mode (no Page Breaks), question-progress tracking is disabled entirely (`src/components/form-components/form-preview-from-plate.tsx:460-476`). The result is a contradiction with the glossary entry at `CONTEXT.md:48`, which says `formQuestionProgress` tracks "Questions, not Blocks" — true in field-by-field, false in card.

The product gap: for a `card` Form with five Questions on Step 2, today's funnel shows that 30 % of Respondents who completed Step 1 never reached Step 3, but cannot say which of the five Questions caused them to abandon. The user-facing analytics question — "in which Step, in which Question did the Respondent drop off?" — is unanswerable from current data.

## Decision

Realign the runtime with the glossary's promise: always emit per-Question progress events, and always carry the Step that contains the Question alongside the Question's own identity. Step-level metrics become a read-time `GROUP BY` over the Question rows; no separate Step-level event stream is stored.

Concretely:

- **Schema (`formQuestionProgress`)**: add `stepId text NULL` and `stepIndex integer NULL`. Every new event populates both, including in `field-by-field` mode (`stepId = "step_<questionIndex>"` so the funnel UI does not need a special case). The legacy `questionId` column continues to hold the **Question's** ID — never a synthetic `step_<N>`.
- **Schema (`formDropoffDaily`)**: add `stepId text` + `stepIndex integer`. Add `terminalDropoffCount integer NOT NULL DEFAULT 0` — the number of Visits where this Question was the **last** one with a `startedAt` and no `completedAt`. Redefine the existing `dropoffCount` to mean "started but not completed" (per-Question intra-Step abandonment), not "viewed − completed" as it does today. The cut date (below) keeps charts from straddling the meaning change.
- **Event semantics (per-Question)**:
  - `view` → fires when the Question's containing Step has mounted. In single-page `card`, all Questions view simultaneously on form load.
  - `start` → fires on first **focus** on the Question within the Visit (once per `(visit, question)`).
  - `complete` → fires when the Respondent advanced past the Question successfully — i.e., the Step submit (or the form Submit in single-page) accepted validation. "Complete" means _advanced past_, not _answered_; an optional Question left blank but submitted still completes.
- **Drop-off semantics (derived at read time)**: THE drop-off Question for a Visit = the Question with the latest `startedAt` whose `completedAt IS NULL` and whose Visit has `didSubmit = false` and `visitEndedAt IS NOT NULL`. At most one drop-off Question per Visit. No stored status column.
- **Funnel UI**: primary view is expandable Step rows — collapsed shows Step-level rollup, expanded shows per-Question children. Secondary, experimental view: a Sankey using `recharts`' built-in `<Sankey>` component, switchable from the existing insights toolbar. Removable if it does not earn its complexity.
- **Single-page `card` math**: with `view` uniform across all Questions on the page, the primary in-mode metric is `(started − completed) / started`, not `(viewed − completed) / viewed`. The funnel component branches on Step count.
- **Write path**: server fn `recordQuestionProgress` becomes `INSERT … ON CONFLICT (visitId, questionId) DO UPDATE …` against a new `UNIQUE (visitId, questionId)` constraint, replacing today's `SELECT → INSERT|UPDATE` and closing the race documented at `src/lib/server-fn/analytics.server.ts:146-149`. The client buffers events and flushes on whichever comes first: 500 ms elapsed, 5 events queued, a Step submit, or page unload (via `navigator.sendBeacon`). A new `recordQuestionProgressBatch` server fn accepts the buffered array.
- **Historical data — cut date**: pre-rework rows stay in the database for Submission integrity but are excluded from analytics queries (`WHERE createdAt >= '<deploy_ts>'`). The funnel surfaces a small "Data available from `<date>`" hint on Forms whose first Visit predates the deploy. No retroactive backfill is attempted; per-Question data for legacy `card` multi-step submissions does not exist and cannot be fabricated.

## Considered Options

**Granularity storage: store both Step and Question events, vs. store Questions and derive Steps.**
Storing both was rejected because the two streams can drift (bot filter behaviour, network hiccup, code path divergence) and double the write volume on every interaction. Storing Questions only and computing Step rollups at read time is a single source of truth; the rollup is a trivial `GROUP BY` on a daily aggregate that is already small (tens of rows per Form per day).

**Step dimension representation: composite `questionId` (e.g. `"step_2__email_abc"`) vs. dedicated `stepId` column.**
Composite IDs were rejected because they push string parsing into every read site and lose the ability to index on Step alone. Two nullable columns are flat, indexable, and cheap. Legacy rows simply leave them `NULL`.

**`start` definition: first focus vs. first input/change event.**
First focus chosen because the analytic question is "did the Respondent reach this Question?" not "did the Respondent engage meaningfully?" Focus captures the tab-in-then-abandon case, which is itself a drop-off signal. The cost is mild inflation from accidental tab-through; that signal is uniform across modes and Questions, so it does not bias comparisons.

**Drop-off labelling: stored `status` column vs. read-time derivation.**
A `status text` column with `'started' | 'completed' | 'dropped'` would require an extra write at Visit-end time and a session-timeout fallback for Visits where the beacon fails (mobile Safari force-quit, etc.). Read-time derivation makes status a deterministic function of `startedAt`, `completedAt`, `visit.didSubmit`, and `visit.visitEndedAt` — no missed-beacon dead rows, no backfill, no risk of the stored status disagreeing with the timestamps it was derived from.

**Single-page `card` drop-off math: `view→complete` (uniform, useless), `start→complete` (the chosen mode-aware metric), or redefining `view` as focus.**
Redefining `view` was rejected because the same word should mean the same thing across modes. Mode-aware math localises the divergence inside the funnel component, where the Step-count branch already exists.

**Historical data: coexist (branch on `stepId IS NULL`), partial backfill (field-by-field only), or cut date.**
Cut date chosen for honesty: there is genuinely no per-Question data for legacy `card` multi-step Submissions; faking a uniform "data available from `<date>`" cut across the product is less confusing than mixing two grains in one chart. Field-by-field backfill was rejected as well — even though the mapping (`stepId = "step_<questionIndex>"`) is mechanical and lossless — to keep the migration single-purpose and the funnel UI free of "this Form started life as v1" footguns.

**Write path: server upsert only, client batching only, or both.**
Both. Server-side upsert is free correctness cleanup (fixes the documented race condition, halves DB queries per event); client-side batching is the real efficiency win at the new event rate (a 20-Question single-page form fires ~60 events per Visit and most arrive in two bursts — form load and form Submit — that batch cleanly).

**Validation-failure tracking.**
Scoped out. The core question ("which Step, which Question did the Respondent drop off?") is fully answered without it. Validation friction is additional _why_ on top of _where_; once the _where_ lands we will have data on whether validation friction is the next biggest gap, and the schema does not preclude adding a `validationFailedAt` column later.

## Consequences

- **The promise to users**: the funnel can now answer "in which Step, in which Question did Respondents drop off?" in every Presentation Mode, including single-page `card`, which previously had no question-progress data at all.
- **The mental model for future contributors**: `formQuestionProgress.questionId` is **always** the Question's ID, never a synthetic Step token. The Step a Question belongs to lives in `stepId`. In `field-by-field`, every Step contains exactly one Question; the `stepId` column is still populated so the funnel UI has a single uniform rendering path.
- **Single-page `card` analytics is now non-trivial.** The funnel component branches on Step count, and the primary intra-Step metric switches from `view→complete` to `start→complete`. This branch is documented in the funnel component header and the metric's column tooltip.
- **The race condition documented in `src/lib/server-fn/analytics.server.ts:146-149` is closed** by the `UNIQUE (visitId, questionId)` constraint plus `INSERT … ON CONFLICT`. The TODO in that file is removed by the migration that adds the constraint.
- **Pre-rework analytics data becomes invisible in the UI** for Forms with Visits older than the deploy date. The rows remain in the database tied to their Submissions; they are simply filtered out of insight reads. The funnel surfaces a "Data available from `<date>`" hint so users do not misread the omission as a bug.
- **Write volume rises** (~4× in card multi-step, from ~3 events per Step to ~3 events per Question per Step). The combined server upsert + client batching is calibrated to keep round-trip count roughly flat for typical forms; very large single-page forms (≥ 20 Questions) trade ~60 events into ~2 batched requests at load and Submit.
- **The `ai-chat` Presentation Mode (planned, `docs/plans/2026-04-27-ai-chat-presentation-mode.md`) is forward-compatible without further design work**: each conversational turn is one Question, and the existing schema (`stepId`, `questionId`, view/start/complete timestamps) maps directly when that mode ships.
- **The Sankey view is explicitly experimental.** If it fails to add insight beyond the expandable funnel, removing it is a delete of one component and one toolbar toggle — no schema or aggregator change.
