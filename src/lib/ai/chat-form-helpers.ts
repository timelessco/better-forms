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
  const label = "label" in el && el.label ? el.label : el.id;
  const required = "required" in el && el.required ? " (required)" : "";
  return `(Question id=${el.id} type=${el.fieldType} label="${label}"${required})`;
};

export type BuildSystemPromptInput = {
  formTitle: string;
  tone: "formal" | "friendly" | "playful";
  language: string;
  content: TransformedElement[];
  currentQuestionId: string | null;
  priorAnswers: Record<string, unknown>;
  greeting: string | null;
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
    "Rules:",
    "  - Emit exactly one tool call. Do not produce free prose outside a tool call.",
    "  - Do not preview future Questions. Do not list them, count them, or hint at what's next.",
    "  - You may briefly acknowledge the prior Answer when natural.",
    "  - Do not invent facts. Only paraphrase content present in the form structure or prior Answers.",
  ].join("\n");
};
