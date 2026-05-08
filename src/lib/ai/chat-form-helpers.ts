import type { PlateFormField, TransformedElement } from "@/lib/editor/transform-plate-to-form";

/**
 * Stable UTC `YYYY-MM` bucket. Used as the period key for the per-Org-Month
 * AI Chat Session cap.
 */
export const monthKey = (now: Date = new Date()): string => now.toISOString().slice(0, 7);

/**
 * Filter `content` down to answerable Questions in canonical order. Excludes
 * static Blocks (headings, paragraphs, page breaks, etc.) and Button fields
 * (which are navigation, not Questions).
 */
export const answerableQuestions = (content: TransformedElement[]): PlateFormField[] =>
  content.filter(
    (el): el is PlateFormField =>
      !("static" in el && el.static === true) && el.fieldType !== "Button",
  );

/**
 * Pick the next Question to ask, given the form `content` and the Answers
 * collected so far. Returns the id of the first Question with no Answer in
 * `priorAnswers`, or `null` when every Question has been answered.
 */
export const computeNextQuestionId = (
  content: TransformedElement[],
  priorAnswers: Record<string, unknown>,
): string | null => {
  for (const question of answerableQuestions(content)) {
    if (!(question.id in priorAnswers)) return question.id;
  }
  return null;
};

const TONE_INSTRUCTIONS = {
  formal: "Use a formal, professional voice. Address the Respondent with courtesy.",
  friendly: "Use a friendly, conversational voice. Be warm but concise.",
  playful: "Use a playful, lighthearted voice. Light humor is welcome.",
} as const;

export const humanizeName = (name: string): string =>
  name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

const renderBlockSummary = (el: TransformedElement): string => {
  if ("static" in el && el.static === true) {
    if (el.fieldType === "PageBreak") {
      return `[PageBreak${el.isThankYouPage ? " — Thank You Page" : ""}]`;
    }
    if (el.fieldType === "Separator" || el.fieldType === "EmptyBlock") {
      return `[${el.fieldType}]`;
    }
    if ("content" in el && typeof el.content === "string") {
      return `[${el.fieldType}: ${el.content}]`;
    }
    return `[${el.fieldType}]`;
  }
  if (el.fieldType === "Button") return `[Button:${el.buttonRole}]`;
  const explicitLabel = "label" in el && el.label ? el.label : null;
  const fieldName = "name" in el && el.name ? el.name : null;
  const label = explicitLabel ?? (fieldName ? humanizeName(fieldName) : el.id);
  const placeholder =
    "placeholder" in el && el.placeholder ? ` placeholder="${el.placeholder}"` : "";
  const required = "required" in el && el.required ? " (required)" : "";
  return `(Question id=${el.id} type=${el.fieldType} label="${label}"${placeholder}${required})`;
};

export type BuildSystemPromptInput = {
  formTitle: string;
  tone: "formal" | "friendly" | "playful";
  language: string;
  content: TransformedElement[];
  currentQuestionId: string | null;
  priorAnswers: Record<string, unknown>;
  greeting: string | null;
  /** Zod-validation error from the previous parse attempt for this reply.
   * When set, the AI is told to either re-extract more carefully or write a
   * specific re-ask explaining the expected format. */
  validationError?: string | null;
};

/**
 * Build the system prompt for one turn. The AI receives the full Form
 * schema (Blocks in canonical order) along with prior Answers, current
 * Question id, tone, and language. Per ADR-0001 the AI is instructed to
 * emit exactly one tool call and never telegraph future Questions.
 */
export const buildSystemPrompt = (input: BuildSystemPromptInput): string => {
  const labelById = new Map<string, string>();
  for (const el of answerableQuestions(input.content)) {
    labelById.set(el.id, ("label" in el && el.label) || el.id);
  }

  const blockList = input.content
    .map((el, i) => `  ${i + 1}. ${renderBlockSummary(el)}`)
    .join("\n");

  const answerLines = Object.entries(input.priorAnswers)
    .map(([qid, value]) => {
      const label = labelById.get(qid) ?? qid;
      return `  - ${label}: ${JSON.stringify(value)}`;
    })
    .join("\n");

  const greetingLine = input.greeting
    ? `\nThe form author has provided this verbatim greeting — open the conversation with it word-for-word, then transition into the first Question:\n"""\n${input.greeting}\n"""\n`
    : "";

  const isFirstTurn = Object.keys(input.priorAnswers).length === 0;
  const firstTurnRule = isFirstTurn
    ? `  - This is the FIRST turn. Open the askQuestion \`prompt\` with a brief warm greeting that name-checks the form title ("${input.formTitle}") in one short sentence, then ask the current Question in the SAME prompt. One bubble, two beats. Do not split into two tool calls.`
    : "";

  const personalizationRule = !isFirstTurn
    ? `  - Personalize when natural: if a prior Answer contains the Respondent's name (look for fields like "Full Name" / "First Name" / "Name"), address them by their first name in your prompts (once, not in every message — use sparingly so it stays natural).`
    : "";

  const validationErrorBlock = input.validationError
    ? [
        "",
        "PREVIOUS PARSE FAILED:",
        `  ${input.validationError}`,
        "  - Re-read the Respondent's reply and try harder to extract a value matching the current Question's expected type.",
        '  - If the reply genuinely cannot satisfy the field (e.g. they said "baskar" when a URL is required), set `parsedValue` to a sensible empty default ("" for text, null for numbers) and write `prompt` as a SPECIFIC re-ask explaining the expected format with an example (e.g. "I need a URL like https://example.com — could you share yours?").',
      ].join("\n")
    : "";

  return [
    `You are guiding a Respondent through a conversational form titled "${input.formTitle}".`,
    `${TONE_INSTRUCTIONS[input.tone]} Respond in ${input.language}.`,
    "",
    "Full form structure (canonical order):",
    blockList || "  (empty)",
    "",
    `Current Question to ask: ${input.currentQuestionId ?? "(none — closing turn)"}`,
    "",
    "Prior Answers from this Respondent:",
    answerLines || "  (none yet)",
    greetingLine,
    validationErrorBlock,
    "Rules:",
    "  - Emit exactly one tool call. Do not produce free prose outside a tool call.",
    "  - Do not preview future Questions. Do not list them, count them, or hint at what's next.",
    "  - You may briefly acknowledge the prior Answer when natural.",
    "  - Do not invent facts. Only paraphrase content present in the form structure or prior Answers.",
    "  - Reference Questions by their `label` (or `placeholder`) — NEVER by `id`. The id is internal and must not appear in any prose.",
    "  - The askQuestion `prompt` must be a complete, natural sentence — never echo the id or label verbatim with a question mark.",
    "",
    "Extraction rules (for confirmParse):",
    "  - Be lenient with verbose Respondent replies. Extract ONLY the value relevant to the current Question; ignore surrounding chatter, hedges, and side commentary.",
    '  - For Number/currency fields: emit a plain number (no commas, no currency symbols, no words). Convert magnitudes (e.g. "1 million" → 1000000, "5k" → 5000, "$100k" → 100000). If the reply contains multiple numbers, pick the one that directly answers the Question (e.g. for "Desired Salary", "100k would be great as I already get 50k" → 100000).',
    "  - For URL fields: emit a fully-qualified https:// URL. If the user gave a domain without a protocol, prepend `https://`. If they gave only a name with no domain or path, leave parsedValue empty so the parse fails cleanly.",
    '  - For Email/Phone: extract just the canonical address/number. Strip leading words like "my email is" or "sure, here\'s my number".',
    "  - For Text fields with constraints (minLength/maxLength): respect them when extracting.",
    "  - Never invent values. If extraction is impossible from the reply, leave parsedValue as a neutral empty default — DO NOT make something up.",
    firstTurnRule,
    personalizationRule,
  ]
    .filter(Boolean)
    .join("\n");
};
