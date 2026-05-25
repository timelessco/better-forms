# AI Chat Presentation Mode

A premium third presentation mode (alongside `card` and `field-by-field`) where the form becomes a conversation. AI greets the user with the form title, asks each field's question conversationally using prior answers as context, and renders the existing field components inside chat bubbles.

Branch: `feat/ai-chat-presentation-mode`.

---

## Architecture

- **AI role**: Director with generative UI. AI emits tool calls; client renders existing field components.
- **Validation handoff**: hybrid.
  - Free-text fields (Input, Textarea, Password) — AI parses user's natural-language reply into the field value, confirmation bubble shown, Zod re-validates, deterministic re-prompt on failure (no AI loop).
  - Structured fields (Select, RadioGroup, MultiSelect, DatePicker, Slider, Switch, Checkbox, ToggleGroup) — render the actual component in a bubble. User clicks/picks. No AI parsing.
- **Conversation state**: stateless. Client owns history; server is a dumb proxy. No `chat_sessions` table. Persisted state is `{fieldId: value}` only, via existing draft autosave + a localStorage mirror.
- **End-of-form**: deterministic submit. AI generates closing prose, client triggers submit.

## Server contract — 4 tools

```ts
askField({ fieldId: string, prompt: string, ackPrior?: string })
confirmParse({ fieldId: string, parsedValue: unknown, prompt: string })  // free-text only
skipField({ fieldId: string, reason: string })                            // only if !field.required
closing({ message: string })
```

The AI **cannot emit free prose outside a tool call** — this prevents hallucinated fields and keeps client rendering deterministic.

Server-side guards:

- Reject any `fieldId` not present in the form's actual schema.
- Reject any `parsedValue` that fails the field's existing Zod validation; fall through to deterministic re-prompt prose instead of looping AI.

## Cost protection

1. **Per-org monthly session cap**: Pro = 500/mo, Biz = 10k/mo. Hard ceiling, checked at session start (not per turn).
2. **Per-IP rate limit** via token bucket.
3. **Model**: gpt-4o-mini for both tiers initially.
4. **Cache** keyed on `(formVersionHash, fieldId)` for first-turn-of-session greeting + first-field prompt. Repeat respondents reuse the same generated prose.
5. **Editor preview**: separate budget — 50 generations/day per builder user — so designers don't burn the respondent quota.

## Plan gating

- **Tier**: Pro and Biz both unlock the mode; cap differs.
- **Builder UI**: 3rd tab `AI Chat ✨` in the Mode picker, wrapped with `FeatureGate` for free users (upgrade tooltip).
- **Server save path**: reject `presentationMode: "ai-chat"` on save if owner is on a free plan. Required — UI gate alone is bypassable.
- **Render path on owner downgrade**: silent fallback to `field-by-field`. Respondents must never see a billing message about someone else's plan.

## Failure modes

- **AI provider down (5xx, timeout)**: fall back to `field-by-field` for the rest of the session. Toast notice. Already-answered fields preserved.
- **Org cap hit mid-session**: finish the current session normally; block new sessions.
- **Single AI call fails (rate limit, transient)**: 1 silent retry with exponential backoff, then deterministic prose ("Let's keep going. {fieldLabel}?") and continue.

The principle: a respondent must never be blocked because of an AI failure. Worst case the form degrades to a plain `field-by-field` flow.

## System prompt context

Required context fed every turn:

- Form title.
- Current field's label / placeholder / fieldType / required.
- Prior answers as `{label: answer}` pairs.
- `settings.language`.
- `settings.aiChatTone` (Formal / Friendly / Playful, default Friendly).

Static content (`H1`, `H2`, `H3`, `FieldDescription`, `FieldLegend`) is fed into the AI's context as section transitions — the AI weaves them into the prose ("Now for some personal details. What's your name?") rather than emitting bare heading bubbles. `PageBreak` / `Separator` are turn boundaries with no bubble.

**Future fields are NOT exposed to the AI** — preserves the conversational feel; prevents telegraphing.

## UX

- **Mode picker**: 3-tab toggle in the share sidebar. Tone radio (Formal / Friendly / Playful) appears below the tabs only when AI Chat is selected.
- **Editor preview**: real AI calls subject to the editor budget cap. Falls back to template-string prose if the cap is hit.
- **Public render**: RSC renders the shell (cover, title, customization). Client renders the chat transcript, with a skeleton bubble during hydration. `public-form-page.tsx` short-circuits its RSC field-render path the same way it does for `field-by-field` today.
- **Embed types**: all three supported. For `standard` (inline) embed, the share sidebar shows a non-blocking nudge: _"AI Chat works best on Full Page or Popup."_
- **Save-for-later**: replay-from-answers on reload. Regenerate greeting + a Q+A bubble for each already-filled field, then resume from the next unfilled field. Prose may differ slightly between resumes; answers are preserved.

## Accessibility (build-it-right + visible escape)

- `aria-live="polite"` on the transcript region.
- Focus management — focus moves to the active input each time a new bubble appears.
- Full keyboard navigation.
- Visible persistent **"Switch to standard form"** button — switches the live session to `field-by-field`, preserves all entered answers.

## Multi-language

- `settings.language` injected into the AI system prompt (`Respond in ${language}`).
- New i18n keys for deterministic prose: `aiChat.invalidRetry`, `aiChat.unavailable`, `aiChat.skipped`, `aiChat.submitted`. A Spanish form must not fall back to English on AI failure.

## Migration

- **DB**: add a migration that locks `forms.presentationMode` to a check constraint covering `card | field-by-field | ai-chat`. The column is currently free-form text; locking it down is overdue and protects against future garbage.
- **Zod**: extend enums in `src/lib/server-fn/forms.ts:44`, `src/lib/server-fn/forms.ts:141`, `src/collections/local/form.ts:56`, `src/lib/server-fn/form-versions.ts:319`.
- **Defaults**: `card` everywhere unchanged. Existing version-snapshot `?? "card"` fallback in `form-versions.ts` keeps old snapshots safe.
- **Types**: extend `PresentationMode` in `src/types/form-settings.ts`.
- **Plan config**: add `BIZ_PRODUCT_IDS` mirroring `PRO_PRODUCT_IDS`; extend `useUserPlan` if/where needed.

## Implementation sequence

Single branch, no feature flag, push only when satisfied.

1. **Type & schema migration** + 3rd tab gated. Picking `ai-chat` does nothing visible yet.
2. **Server endpoint** `/api/ai/chat-form.ts` with the 4 tools, plan check, per-org cap. Unit tests on tool validation.
3. **Client chat shell**: a11y transcript, input bar, "Switch to standard form" escape link, deterministic re-prompts, AI-down fallback.
4. **Field-component adapters**: `<ChatBubble>` wrappers around each field component in `src/components/form-components/`.
5. **Editor preview**: real-AI integration + editor budget. Tone selector in share sidebar.
6. **Save-for-later replay**: replay-from-answers on reload.
7. **Telemetry**: per-org session counter, surface in billing UI.
8. **Polish**: loading skeletons, reduced-motion, Spanish/French i18n, embed-type warnings.

---

## Open questions / things to revisit during implementation

- Final cap numbers (500 / 10k / 50) are starting guesses — adjust after first month of real usage.
- If gpt-4o-mini quality is insufficient for parsing, may need to upgrade Biz tier to gpt-4o.
- Cache key includes `formVersionHash` — confirm content-hash already changes when label/placeholder change (it should, per `src/lib/content-hash.ts`).
- Phase-2 candidate: AI-generated clarifying follow-ups (`clarify` tool) for fields where the answer is ambiguous. Deferred from v1.
