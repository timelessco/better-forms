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

const isEmptyParsedValue = (value: unknown): boolean =>
  value === "" ||
  value === null ||
  value === undefined ||
  (Array.isArray(value) && value.length === 0);

// Hint sent to the server as `validationError` when an optional field's reply
// parsed to a blank, so the AI produces a specific, type-aware re-ask.
const emptyValueValidationError = (q: PlateFormField | undefined): string => {
  switch (q?.fieldType) {
    case "Email":
      return "The reply does not contain a valid email address.";
    case "Link":
      return "The reply does not contain a valid URL.";
    case "Number":
      return "The reply does not contain a valid number.";
    default:
      return "The reply does not contain a usable answer for this question.";
  }
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
        priorAnswers?: Record<string, unknown>;
        validationError?: string;
      },
    ): Promise<ChatFormResponse & { _terminal?: boolean }> => {
      aiCallCountRef.current += 1;
      try {
        const res = await fetch("/api/ai/chat-form", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent,
            formId,
            submissionId,
            currentQuestionId: body.currentQuestionId ?? undefined,
            userText: body.userText,
            priorAnswers: body.priorAnswers ?? {},
            validationError: body.validationError,
            isPreview: isPreview ?? false,
          }),
        });
        // 403/429 are terminal — plan/cap/rate-limit failures don't recover on retry.
        const isTerminalStatus = res.status === 403 || res.status === 429;
        // Defend against non-JSON 5xx responses: if json() throws, fall back to
        // a synthetic error so the caller's error path runs and the UI doesn't
        // get stuck in `phase: "loading"` forever.
        let json: ChatFormResponse;
        try {
          json = (await res.json()) as ChatFormResponse;
        } catch {
          json = { error: "server_error" } as ChatFormResponse;
        }
        if (!res.ok && !("error" in json)) {
          json = { error: `http_${res.status}` } as ChatFormResponse;
        }
        if (isTerminalStatus) {
          return { ...json, _terminal: true } as ChatFormResponse & { _terminal: true };
        }
        return json;
      } catch {
        // Network failure (offline, DNS, etc.) — don't let the throw bubble up
        // and freeze the UI. Return a soft error and let the failure-budget
        // logic decide whether to retry or trip to standard form.
        return { error: "network_failure" } as ChatFormResponse;
      }
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
    // `latestAnswers` is passed explicitly by callers — relying on the `answers`
    // closure here lags one Question behind (state updates are async), so the
    // AI couldn't see the just-given Answer when asking the NEXT Question.
    async (nextQid: string | null, latestAnswers: Record<string, unknown>) => {
      parseAttemptsRef.current = 0;
      if (!nextQid) {
        // No more Questions — call finish.
        setCurrentQuestionId(null);
        setPhase("loading");
        const res = await callApi("finish", {
          currentQuestionId: null,
          priorAnswers: latestAnswers,
        });
        if ("error" in res) {
          if (recordFailure(isTerminal(res))) return;
          appendBubble({ kind: "ai", id: newBubbleId(), prompt: t.aiChatSubmitted });
        } else if (res.tool === "closing") {
          recordSuccess();
          appendBubble({ kind: "ai", id: newBubbleId(), prompt: res.args.message });
        }
        setPhase("submitting");
        await onSubmit(latestAnswers);
        setPhase("closed");
        return;
      }
      setCurrentQuestionId(nextQid);
      setPhase("loading");
      const res = await callApi("advance", {
        currentQuestionId: nextQid,
        priorAnswers: latestAnswers,
      });
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

    const nextUnanswered = computeNextQuestionId(content, answers);
    const isResume = Object.keys(answers).length > 0;
    // On a RESUME where every Question is already answered, re-present the last
    // Question instead of auto-finishing — otherwise reloading a complete (but
    // not-yet-submitted) draft would fire onSubmit unattended. A genuinely fresh
    // empty form (no answers) still goes straight to the closing turn.
    const firstQid =
      nextUnanswered ?? (isResume ? (answerableQuestions(content).at(-1)?.id ?? null) : null);
    if (!firstQid) {
      await advanceTo(null, answers);
      return;
    }
    setCurrentQuestionId(firstQid);
    const res = await callApi("start", { currentQuestionId: firstQid, priorAnswers: answers });
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
        priorAnswers: answers,
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
            shape?: Record<
              string,
              {
                safeParse: (v: unknown) => { success: boolean; error?: { message: string } };
              }
            >;
          }
        ).shape?.[currentQuestionId];
        const parseResult = fieldSchema?.safeParse(res.args.parsedValue);
        const q = questionById.get(currentQuestionId);
        const isRequired = !!(q && "required" in q && q.required);

        // Explicit decline ("not willing to share", "I don't have one", "skip").
        if (res.args.declined) {
          if (!isRequired) {
            // Optional → honor it immediately, no re-ask.
            appendBubble({ kind: "system", id: newBubbleId(), text: t.aiChatSkipped });
            const next = { ...answers, [currentQuestionId]: null };
            const nextQid = computeNextQuestionId(content, next);
            updateAnswers(next);
            await advanceTo(nextQid, next);
            return;
          }
          // Required → can't be skipped. Re-ask and wait for a real answer, but
          // do NOT count it as a failure: a decline shouldn't trip the whole
          // chat to the standard form.
          recordSuccess();
          appendBubble({
            kind: "ai",
            id: newBubbleId(),
            prompt: res.args.prompt?.trim() || t.aiChatInvalidRetry,
          });
          setPhase("ready");
          return;
        }

        // The Respondent's reply is non-empty here (empty replies return early),
        // so a blank parse means the AI couldn't extract a real value. Optional
        // fields accept "" at the schema level, but the Respondent tried to
        // answer — treat an empty parse as invalid so we re-ask once (bounded by
        // MAX_PARSE_ATTEMPTS) instead of silently recording a blank.
        const parsedIsEmpty = isEmptyParsedValue(res.args.parsedValue);
        const schemaOk = parseResult ? parseResult.success : true;
        const valid = schemaOk && !parsedIsEmpty;
        if (!valid) {
          parseAttemptsRef.current += 1;
          if (parseAttemptsRef.current >= MAX_PARSE_ATTEMPTS) {
            // Out of attempts — show the AI's prompt if it provided one (it's
            // usually a helpful "I need a URL like…" message), else fallback,
            // then either skip (if optional) or trip (if required).
            const aiRetryText = res.args.prompt?.trim() || t.aiChatInvalidRetry;
            appendBubble({ kind: "ai", id: newBubbleId(), prompt: aiRetryText });
            if (!isRequired) {
              appendBubble({ kind: "system", id: newBubbleId(), text: t.aiChatSkipped });
              // Record the skip as null (matches the manual Skip button) so the
              // next turn's prompt knows this Question was handled and won't
              // re-acknowledge an earlier Answer.
              const next = { ...answers, [currentQuestionId]: null };
              const nextQid = computeNextQuestionId(content, next);
              updateAnswers(next);
              await advanceTo(nextQid, next);
              return;
            }
            trip();
            return;
          }
          // Re-ask with the validation error as AI context — server adds it
          // to the system prompt so the AI can produce a specific re-ask
          // (e.g. "I need a URL starting with https://" instead of generic).
          const validationError = parseResult?.error?.message ?? emptyValueValidationError(q);
          const retry = await callApi("parse-and-advance", {
            currentQuestionId,
            userText: trimmed,
            priorAnswers: answers,
            validationError,
          });
          if ("error" in retry) {
            if (recordFailure(isTerminal(retry))) return;
            appendBubble({ kind: "ai", id: newBubbleId(), prompt: t.aiChatInvalidRetry });
            setPhase("ready");
            return;
          }
          if (retry.tool === "confirmParse") {
            const retryParse = fieldSchema?.safeParse(retry.args.parsedValue);
            if (retryParse?.success && !isEmptyParsedValue(retry.args.parsedValue)) {
              // AI's contextualized retry actually parsed cleanly this time.
              recordSuccess();
              const next = { ...answers, [currentQuestionId]: retry.args.parsedValue };
              updateAnswers(next);
              const nextQid = computeNextQuestionId(content, next);
              await advanceTo(nextQid, next);
              return;
            }
            // Still invalid; render the AI's contextual prompt as the retry.
            const retryText = retry.args.prompt?.trim() || t.aiChatInvalidRetry;
            appendBubble({ kind: "ai", id: newBubbleId(), prompt: retryText });
            setPhase("ready");
            return;
          }
          appendBubble({ kind: "ai", id: newBubbleId(), prompt: t.aiChatInvalidRetry });
          setPhase("ready");
          return;
        }
        recordSuccess();
        const next = { ...answers, [currentQuestionId]: res.args.parsedValue };
        updateAnswers(next);
        // `confirmParse.prompt` is unreliable as a next-Q bubble — the server's
        // system prompt only tells the AI about the *current* Q, so the AI's
        // prompt often re-asks the same one. Discard it; let `advance`'s
        // askQuestion.prompt be the single next-Q bubble.
        const nextQid = computeNextQuestionId(content, next);
        await advanceTo(nextQid, next);
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
      await advanceTo(nextQid, next);
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
    await advanceTo(nextQid, next);
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
