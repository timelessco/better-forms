import type { PublicFormSettings } from "@/types/form-settings";
import type { TransformedElement } from "@/lib/editor/transform-plate-to-form";

export type ChatBubble =
  | { kind: "ai"; id: string; prompt: string }
  | { kind: "user-text"; id: string; text: string }
  | { kind: "user-pick"; id: string; label: string }
  | { kind: "ack"; id: string; text: string }
  | { kind: "system"; id: string; text: string }
  | { kind: "recap"; id: string; entries: { label: string; value: unknown }[] };

export type ChatPhase = "loading" | "ready" | "submitting" | "closed" | "fallback";

export type AiToolEmission =
  | { tool: "askQuestion"; args: { prompt: string; ackPrior?: string } }
  | { tool: "confirmParse"; args: { parsedValue: unknown; prompt: string } }
  | { tool: "closing"; args: { message: string } };

export type ChatFormResponse =
  | (AiToolEmission & { questionId: string | null })
  | {
      error: string;
      used?: number;
      limit?: number;
      _terminal?: boolean;
    };

export type AiChatFormProps = {
  formId: string;
  submissionId: string;
  content: TransformedElement[];
  settings: PublicFormSettings;
  /** Called when the Respondent presses "Switch to standard form" or AI fails repeatedly. */
  onSwitchToStandard: () => void;
  /** Called with the final Answers map when the form is ready to submit. */
  onSubmit: (answers: Record<string, unknown>) => Promise<void> | void;
  /** Called whenever Answers change (used by the existing draft autosave). */
  onAnswersChange?: (answers: Record<string, unknown>) => void;
  /** Builder-side preview routes through the editor preview budget. */
  isPreview?: boolean;
  /** Optional pre-existing Answers (for resume after Incomplete Submission). */
  initialAnswers?: Record<string, unknown>;
};
