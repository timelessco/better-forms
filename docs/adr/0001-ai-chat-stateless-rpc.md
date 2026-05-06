# AI Chat is a stateless RPC, not an agent loop

The AI Chat **Presentation Mode** server (`/api/ai/chat-form`) is a stateless RPC — each request maps to exactly one tool emission (`askQuestion` / `confirmParse` / `skipQuestion` / `closing`) — rather than a streaming agentic loop with chat history. State is reconstructed every turn from the existing **Incomplete Submission** plus form-schema-derived metadata; there is no `chat_sessions` table.

## Why

- **Bounded cost.** Worst-case AI calls per **Chat Session** = `N + 2` for an N-Question Form. No server-side loops on parse failure (deterministic re-prompt instead). The Pro/Business per-Org-Month caps depend on this bound.
- **Reuses existing persistence.** Answers already live in `submissions.data`; the Chat Session is 1:1 with the Incomplete Submission. No new session lifecycle to manage.
- **AI cannot hallucinate Questions.** The server validates every inbound `questionId` against the published Form Version's schema, and the AI is constrained to emit one of four tools — it cannot produce free prose outside a tool call.
- **Server picks the next Question; AI only styles it.** Each turn the server computes the next `questionId` from the schema (linear order in v1) and instructs the AI to render the prompt for that specific id. The AI cannot re-order, skip, or branch on its own.
- **AI receives the full Form schema as context, not just the current Question.** Every turn the prompt includes all Blocks in canonical order — Questions, headings, paragraphs, FieldDescription, FieldLegend, Thank You Page — plus prior Answers and Settings (tone, language). This lets the AI generate cohesive prose that gestures at the form's overall purpose. The system prompt forbids explicit telegraphing of future Questions ("next we'll ask…"). Trade-off vs hiding future Questions: slightly larger per-turn payload; offset by far more natural conversation. Per-turn token bump is negligible at the chosen model's pricing.
- **Prior AI prose is never sent back to the AI.** Only Answers cross turns. The AI reconstructs its "voice" each turn from full-form context + tone + Answers, not from a transcript of what it said before.

## Consequences

- Conditional Question logic (branching) is out of scope for v1 — Question order is linear. If branching is added later, next-Question computation moves server-side but the model stays stateless.
- A respondent who pauses and resumes mid-Form regenerates AI prose for already-answered Questions; the Answers themselves are preserved verbatim.
- Adding multi-turn AI memory later (e.g. clarifying follow-ups) would require either inflating the per-turn payload or introducing a sessions table — both reverse this decision.
