import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadFormFile } from "@/lib/server-fn/public-file-uploads";
import { getTranslations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import type { AiChatFormProps } from "./types";
import { QuestionBubble } from "./question-bubble";
import { useAiChatSession } from "./use-ai-chat-session";

const FloatingPanel = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-2xl px-4 pt-2 pb-6">{children}</div>
);

const FloatingMessage = ({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) => (
  <FloatingPanel>
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-3 text-center text-sm shadow-lg",
        muted && "text-muted-foreground",
      )}
    >
      {children}
    </div>
  </FloatingPanel>
);

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(file);
  });

const isFreeTextQuestion = (fieldType: string | undefined): boolean =>
  fieldType === "Input" ||
  fieldType === "Textarea" ||
  fieldType === "Email" ||
  fieldType === "Number" ||
  fieldType === "Link";

const isFileUploadQuestion = (fieldType: string | undefined): boolean => fieldType === "FileUpload";

const formatAnswerValue = (value: unknown): string => {
  if (value == null) return "(skipped)";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

type RecapEntry = { label: string; value: unknown };

const RecapBubble = ({
  entries,
  t,
}: {
  entries: RecapEntry[];
  t: { aiChatResumeRecap: string };
}) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left font-medium"
        aria-expanded={expanded}
      >
        <span>
          {t.aiChatResumeRecap} ({entries.length})
        </span>
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {entries.map((e, i) => (
            <li key={`${e.label}-${i}`}>
              <span className="font-medium text-foreground">{e.label}:</span>{" "}
              {formatAnswerValue(e.value)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AiChatForm = (props: AiChatFormProps) => {
  const {
    formId,
    submissionId,
    content,
    settings,
    onSwitchToStandard,
    onSubmit,
    onAnswersChange,
    isPreview,
    initialAnswers,
  } = props;

  const t = useMemo(() => getTranslations(settings.language ?? "English"), [settings.language]);

  const session = useAiChatSession({
    formId,
    submissionId,
    content,
    settings,
    isPreview,
    initialAnswers,
    onAnswersChange,
    onSubmit,
    onTrip: onSwitchToStandard,
  });

  const transcriptRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");

  // Focus management — focus the composer each time we transition INTO the
  // "ready" phase (i.e. a new Question is awaiting input). Don't re-focus on
  // every bubble change, as that would steal focus mid-typing on resume.
  useEffect(() => {
    if (session.phase === "ready") {
      composerRef.current?.focus();
    }
  }, [session.phase]);

  // Scroll the latest bubble into view. Respect prefers-reduced-motion.
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [session.bubbles.length]);

  const currentQ = session.currentQuestion;
  const currentIsFreeText = isFreeTextQuestion(currentQ?.fieldType);
  const currentIsFileUpload = isFileUploadQuestion(currentQ?.fieldType);
  const currentIsStructured = currentQ && !currentIsFreeText && !currentIsFileUpload;
  const canSkip = Boolean(currentQ && "required" in currentQ && !currentQ.required);

  const handleSubmit = useCallback(async () => {
    const text = draft;
    setDraft("");
    await session.submitFreeText(text);
  }, [draft, session]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!currentQ || currentQ.fieldType !== "FileUpload") return;
      try {
        const base64 = await fileToBase64(file);
        const uploaded = await uploadFormFile({
          data: {
            formId,
            draftId: submissionId,
            fieldName: currentQ.name,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            base64,
          },
        });
        await session.pickStructured(uploaded, file.name);
      } catch {
        // Respondent can retry; upload failures don't burn AI cost.
      }
    },
    [currentQ, formId, session, submissionId],
  );

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">AI Chat</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSwitchToStandard}
          className="text-xs"
        >
          {t.aiChatSwitchToStandard}
        </Button>
      </header>

      <div
        ref={transcriptRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-6"
      >
        {session.bubbles.map((b) => {
          if (b.kind === "ai") {
            return (
              <div key={b.id} className="max-w-[80%] rounded-2xl bg-muted px-4 py-2 text-sm">
                {b.prompt}
              </div>
            );
          }
          if (b.kind === "ack") {
            return (
              <div
                key={b.id}
                className="max-w-[80%] rounded-2xl bg-muted/60 px-4 py-1.5 text-xs text-muted-foreground italic"
              >
                {b.text}
              </div>
            );
          }
          if (b.kind === "user-text" || b.kind === "user-pick") {
            const text = b.kind === "user-text" ? b.text : b.label;
            return (
              <div
                key={b.id}
                className="ml-auto max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                {text}
              </div>
            );
          }
          if (b.kind === "recap") {
            return <RecapBubble key={b.id} entries={b.entries} t={t} />;
          }
          // system
          return (
            <div key={b.id} className="text-center text-xs text-muted-foreground" role="status">
              {b.text}
            </div>
          );
        })}

        {session.phase === "loading" && (
          <div
            className="max-w-[80%] rounded-2xl bg-muted px-4 py-2"
            aria-label="AI is composing"
            role="status"
          >
            <span className="inline-flex gap-1" aria-hidden="true">
              <span className="size-1.5 rounded-full bg-muted-foreground/70 [animation-delay:-0.3s] motion-safe:animate-bounce" />
              <span className="size-1.5 rounded-full bg-muted-foreground/70 [animation-delay:-0.15s] motion-safe:animate-bounce" />
              <span className="size-1.5 rounded-full bg-muted-foreground/70 motion-safe:animate-bounce" />
            </span>
          </div>
        )}
      </div>

      {session.phase === "ready" && currentIsFreeText && (
        <FloatingPanel>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            onClick={() => composerRef.current?.focus()}
            className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-lg focus-within:ring-2 focus-within:ring-ring/40"
          >
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Type your reply…"
              aria-label="Your reply"
              rows={1}
              className="min-h-12 w-full resize-none border-0 bg-transparent px-2 py-2 text-sm text-foreground caret-current outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="sm" disabled={!draft.trim()}>
              Send
            </Button>
          </form>
          {canSkip && (
            <button
              type="button"
              onClick={() => void session.requestSkip()}
              className="mt-2 text-xs text-muted-foreground underline"
            >
              {t.aiChatSkipped}
            </button>
          )}
        </FloatingPanel>
      )}

      {session.phase === "ready" && currentIsStructured && currentQ && (
        <FloatingPanel>
          <div className="rounded-2xl border border-border bg-card p-3 shadow-lg">
            <QuestionBubble
              question={currentQ}
              onPick={(value, label) => session.pickStructured(value, label)}
              onSkip={canSkip ? () => void session.requestSkip() : undefined}
              canSkip={canSkip}
            />
          </div>
        </FloatingPanel>
      )}

      {session.phase === "ready" && currentIsFileUpload && currentQ && (
        <FloatingPanel>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-lg">
            <input
              id={`file-${currentQ.id}`}
              type="file"
              className="sr-only"
              accept={"accept" in currentQ ? currentQ.accept : undefined}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <label
              htmlFor={`file-${currentQ.id}`}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted/60"
            >
              📎 Attach file
            </label>
            {canSkip && (
              <button
                type="button"
                onClick={() => void session.requestSkip()}
                className="text-xs text-muted-foreground underline"
              >
                {t.aiChatSkipped}
              </button>
            )}
          </div>
        </FloatingPanel>
      )}

      {session.phase === "submitting" && <FloatingMessage muted>{t.submitting}</FloatingMessage>}

      {session.phase === "closed" && <FloatingMessage>{t.aiChatSubmitted}</FloatingMessage>}

      {session.phase === "fallback" && (
        <FloatingMessage muted>{t.aiChatUnavailable}</FloatingMessage>
      )}
    </div>
  );
};
