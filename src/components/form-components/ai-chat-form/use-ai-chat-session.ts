import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  answerableQuestions,
  computeNextQuestionId,
  humanizeName,
} from "@/lib/ai/chat-form-helpers";
import { generateZodSchemaFromFields } from "@/lib/form-schema/generate-preview-schema";
import { getTranslations } from "@/lib/translations";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import type { AiChatFormProps, ChatBubble, ChatFormResponse, ChatPhase } from "./types";

const MAX_CONSECUTIVE_FAILURES = 3;
const MAX_TOTAL_FAILURES = 5;
const MAX_PARSE_ATTEMPTS = 2;

const newBubbleId = () => `b_${crypto.randomUUID()}`;

const isTerminal = (res: ChatFormResponse): boolean => "error" in res && res._terminal === true;

const labelOf = (q: PlateFormField | undefined, fallback: string): string => {
  if (q && "label" in q && q.label) return q.label;
  if (q && "name" in q && q.name) return humanizeName(q.name);
  return fallback;
};

type Args = Pick<
  AiChatFormProps,
  "formId" | "submissionId" | "content" | "settings" | "isPreview" | "initialAnswers"
> & {
  onAnswersChange?: (answers: Record<string, unknown>) => void;
  onSubmit: (answers: Record<string, unknown>) => Promise<void> | void;
  onTrip: () => void;
};

export const useAiChatSession = ({
  formId,
  submissionId,
  content,
  settings,
  isPreview,
  initialAnswers,
  onAnswersChange,
  onSubmit,
  onTrip,
}: Args) => {
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [phase, setPhase] = useState<ChatPhase>("loading");
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers ?? {});
  const consecutiveFailuresRef = useRef(0);
  const totalFailuresRef = useRef(0);
  const aiCallCountRef = useRef(0);
  const parseAttemptsRef = useRef(0);
  const startedRef = useRef(false);

  const questions = useMemo(() => answerableQuestions(content), [content]);
  const hardCeiling = useMemo(() => 2 * questions.length + 5, [questions.length]);
  const t = useMemo(() => getTranslations(settings.language ?? "English"), [settings.language]);
  const validationSchema = useMemo(() => generateZodSchemaFromFields(questions), [questions]);

  const questionById = useMemo(() => {
    const map = new Map<string, PlateFormField>();
    for (const q of questions) map.set(q.id, q);
    return map;
  }, [questions]);

  const appendBubble = useCallback((b: ChatBubble) => {
    setBubbles((prev) => [...prev, b]);
  }, []);

  const updateAnswers = useCallback(
    (next: Record<string, unknown>) => {
      setAnswers(next);
      onAnswersChange?.(next);
    },
    [onAnswersChange],
  );

  const callApi = useCallback(
    async (
      intent: "start" | "advance" | "parse-and-advance" | "finish",
      body: {
        currentQuestionId?: string | null;
        userText?: string;
      },
    ): Promise<ChatFormResponse & { _terminal?: boolean }> => {
      aiCallCountRef.current += 1;
      const res = await fetch("/api/ai/chat-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          formId,
          submissionId,
          currentQuestionId: body.currentQuestionId ?? undefined,
          userText: body.userText,
          isPreview: isPreview ?? false,
        }),
      });
      const json = (await res.json()) as ChatFormResponse;
      // 403/429 are terminal — plan/cap/rate-limit failures don't recover on retry.
      if (res.status === 403 || res.status === 429) {
        return { ...json, _terminal: true } as ChatFormResponse & { _terminal: true };
      }
      return json;
    },
    [formId, submissionId, isPreview],
  );

  const trip = useCallback(() => {
    appendBubble({ kind: "system", id: newBubbleId(), text: t.aiChatUnavailable });
    setPhase("fallback");
    onTrip();
  }, [appendBubble, onTrip, t.aiChatUnavailable]);

  const recordFailure = useCallback(
    (terminal = false) => {
      if (terminal) {
        trip();
        return true;
      }
      consecutiveFailuresRef.current += 1;
      totalFailuresRef.current += 1;
      if (
        consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES ||
        totalFailuresRef.current >= MAX_TOTAL_FAILURES ||
        aiCallCountRef.current >= hardCeiling
      ) {
        trip();
        return true;
      }
      return false;
    },
    [hardCeiling, trip],
  );

  const recordSuccess = useCallback(() => {
    consecutiveFailuresRef.current = 0;
  }, []);

  const advanceTo = useCallback(
    async (nextQid: string | null) => {
      parseAttemptsRef.current = 0;
      if (!nextQid) {
        // No more Questions — call finish.
        setCurrentQuestionId(null);
        setPhase("loading");
        const res = await callApi("finish", { currentQuestionId: null });
        if ("error" in res) {
          if (recordFailure(isTerminal(res))) return;
          appendBubble({ kind: "ai", id: newBubbleId(), prompt: t.aiChatSubmitted });
        } else if (res.tool === "closing") {
          recordSuccess();
          appendBubble({ kind: "ai", id: newBubbleId(), prompt: res.args.message });
        }
        setPhase("submitting");
        await onSubmit(answers);
        setPhase("closed");
        return;
      }
      setCurrentQuestionId(nextQid);
      setPhase("loading");
      const res = await callApi("advance", { currentQuestionId: nextQid });
      if ("error" in res) {
        if (recordFailure(isTerminal(res))) return;
        const label = labelOf(questionById.get(nextQid), "your answer");
        appendBubble({ kind: "ai", id: newBubbleId(), prompt: `${label}?` });
        setPhase("ready");
        return;
      }
      if (res.tool === "askQuestion") {
        recordSuccess();
        if (res.args.ackPrior) {
          appendBubble({ kind: "ack", id: newBubbleId(), text: res.args.ackPrior });
        }
        appendBubble({ kind: "ai", id: newBubbleId(), prompt: res.args.prompt });
      }
      setPhase("ready");
    },
    [
      answers,
      appendBubble,
      callApi,
      onSubmit,
      questionById,
      recordFailure,
      recordSuccess,
      t.aiChatSubmitted,
    ],
  );

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Resume recap is built deterministically from stored Answers — no AI cost.
    if (Object.keys(answers).length > 0) {
      const entries = Object.entries(answers).map(([qid, value]) => ({
        label: labelOf(questionById.get(qid), qid),
        value,
      }));
      appendBubble({ kind: "recap", id: newBubbleId(), entries });
    }

    const firstQid = computeNextQuestionId(content, answers);
    if (!firstQid) {
      await advanceTo(null);
      return;
    }
    setCurrentQuestionId(firstQid);
    const res = await callApi("start", { currentQuestionId: firstQid });
    const fallbackLabel = labelOf(questionById.get(firstQid), "your answer");
    if ("error" in res) {
      if (recordFailure(isTerminal(res))) return;
      appendBubble({ kind: "ai", id: newBubbleId(), prompt: `${fallbackLabel}?` });
      setPhase("ready");
      return;
    }
    if (res.tool === "askQuestion") {
      recordSuccess();
      appendBubble({ kind: "ai", id: newBubbleId(), prompt: res.args.prompt });
    } else {
      // Defensive: API returned an unexpected tool shape on `start`. Surface a
      // deterministic question prompt rather than leaving the transcript blank.
      appendBubble({ kind: "ai", id: newBubbleId(), prompt: `${fallbackLabel}?` });
    }
    setPhase("ready");
  }, [
    advanceTo,
    answers,
    appendBubble,
    callApi,
    content,
    questionById,
    recordFailure,
    recordSuccess,
  ]);

  // Auto-start on mount only — `start`'s dependency churn (answers etc.) must
  // not re-trigger it; the `startedRef` inside guards against double-fire.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only
  useEffect(() => {
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitFreeText = useCallback(
    async (rawText: string) => {
      if (phase !== "ready" || !currentQuestionId) return;
      const trimmed = rawText.trim();
      if (!trimmed) return;
      appendBubble({ kind: "user-text", id: newBubbleId(), text: trimmed });
      setPhase("loading");

      const res = await callApi("parse-and-advance", {
        currentQuestionId,
        userText: trimmed,
      });
      if ("error" in res) {
        if (recordFailure(isTerminal(res))) return;
        appendBubble({ kind: "ai", id: newBubbleId(), prompt: t.aiChatInvalidRetry });
        setPhase("ready");
        return;
      }
      if (res.tool === "confirmParse") {
        const fieldSchema = (
          validationSchema as {
            shape?: Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
          }
        ).shape?.[currentQuestionId];
        const valid = fieldSchema ? fieldSchema.safeParse(res.args.parsedValue).success : true;
        if (!valid) {
          parseAttemptsRef.current += 1;
          appendBubble({ kind: "ai", id: newBubbleId(), prompt: t.aiChatInvalidRetry });
          if (parseAttemptsRef.current >= MAX_PARSE_ATTEMPTS) {
            const q = questionById.get(currentQuestionId);
            const required = q && "required" in q ? q.required : false;
            if (!required) {
              appendBubble({ kind: "system", id: newBubbleId(), text: t.aiChatSkipped });
              const next = { ...answers };
              const nextQid = computeNextQuestionId(content, {
                ...next,
                [currentQuestionId]: null,
              });
              updateAnswers(next);
              await advanceTo(nextQid);
              return;
            }
            // Required Q stuck in a loop — escape to standard.
            trip();
            return;
          }
          setPhase("ready");
          return;
        }
        recordSuccess();
        const next = { ...answers, [currentQuestionId]: res.args.parsedValue };
        updateAnswers(next);
        appendBubble({ kind: "ai", id: newBubbleId(), prompt: res.args.prompt });
        const nextQid = computeNextQuestionId(content, next);
        await advanceTo(nextQid);
      }
    },
    [
      advanceTo,
      answers,
      appendBubble,
      callApi,
      content,
      currentQuestionId,
      phase,
      questionById,
      recordFailure,
      recordSuccess,
      t.aiChatInvalidRetry,
      t.aiChatSkipped,
      trip,
      updateAnswers,
      validationSchema,
    ],
  );

  const pickStructured = useCallback(
    async (value: unknown, label: string) => {
      if (phase !== "ready" || !currentQuestionId) return;
      appendBubble({ kind: "user-pick", id: newBubbleId(), label });
      const next = { ...answers, [currentQuestionId]: value };
      updateAnswers(next);
      const nextQid = computeNextQuestionId(content, next);
      await advanceTo(nextQid);
    },
    [advanceTo, answers, appendBubble, content, currentQuestionId, phase, updateAnswers],
  );

  const requestSkip = useCallback(async () => {
    if (phase !== "ready" || !currentQuestionId) return;
    const q = questionById.get(currentQuestionId);
    if (q && "required" in q && q.required) return;
    appendBubble({ kind: "system", id: newBubbleId(), text: t.aiChatSkipped });
    const next = { ...answers, [currentQuestionId]: null };
    updateAnswers(next);
    const nextQid = computeNextQuestionId(content, next);
    await advanceTo(nextQid);
  }, [
    advanceTo,
    answers,
    appendBubble,
    content,
    currentQuestionId,
    phase,
    questionById,
    t.aiChatSkipped,
    updateAnswers,
  ]);

  return {
    bubbles,
    phase,
    currentQuestion: currentQuestionId ? (questionById.get(currentQuestionId) ?? null) : null,
    submitFreeText,
    pickStructured,
    requestSkip,
  };
};
