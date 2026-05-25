import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import type { Components } from "streamdown";
import { Button } from "@/components/ui/button";
import { FormShareCard } from "@/components/form-components/form-share-card";
import { UploadIcon } from "@/components/ui/icons";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useFormPersistence } from "@/hooks/use-form-persistence";
import {
  buildAcceptString,
  buildPlaceholderLabel,
  DEFAULT_MAX_FILE_SIZE_MB,
  resolveAllowedSubtypes,
} from "@/lib/form-schema/file-upload-types";
import type { UploadedFormFile } from "@/lib/form-schema/file-upload-types";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { getTranslations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import type { AiChatFormProps } from "./types";
import { QuestionBubble } from "./question-bubble";
import { useAiChatSession } from "./use-ai-chat-session";

type FileUploadFieldType = Extract<PlateFormField, { fieldType: "FileUpload" }>;

// Composer shown only for FileUpload Questions: an attach button that opens the
// file picker, inheriting the field's accepted types + max size (same helpers
// the standard FileUploadField uses). The server re-validates MIME/size via the
// upload token keyed by `fieldName`.
const FileUploadComposer = ({
  question,
  onPickFile,
  onSkip,
  canSkip,
  skipLabel,
}: {
  question: FileUploadFieldType;
  onPickFile: (file: File) => Promise<void>;
  onSkip?: () => void;
  canSkip: boolean;
  skipLabel: string;
}) => {
  const { category, subtypes } = useMemo(
    () => resolveAllowedSubtypes(question.allowedFileTypes, question.allowedFileExtensions),
    [question.allowedFileTypes, question.allowedFileExtensions],
  );
  const accept = useMemo(() => buildAcceptString(category, subtypes), [category, subtypes]);
  const placeholderLabel = useMemo(
    () => buildPlaceholderLabel(category, subtypes),
    [category, subtypes],
  );
  const maxFileSizeMb = question.maxFileSize ?? DEFAULT_MAX_FILE_SIZE_MB;
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `useFileUpload` fires `onFilesChange` from inside a setState updater, which
  // React double-invokes under StrictMode (dev). Without this guard the upload
  // (and the Question advance) would run twice — duplicate bubbles. The ref
  // updates synchronously, so the second invocation is dropped.
  const submittingRef = useRef(false);

  const [, fileActions] = useFileUpload({
    accept,
    maxSize: maxFileSizeMb * 1024 * 1024,
    onError: (errors) => setError(errors[0] ?? "That file can't be uploaded."),
    onFilesChange: (files) => {
      const picked = files[0]?.file;
      if (!(picked instanceof File) || submittingRef.current) return;
      submittingRef.current = true;
      setError(null);
      setUploadingName(picked.name);
      onPickFile(picked)
        .catch(() => setError("Upload failed. Please try again."))
        .finally(() => {
          setUploadingName(null);
          submittingRef.current = false;
        });
    },
  });

  const uploading = uploadingName !== null;
  return (
    <div className="rounded-2xl border border-border bg-card p-2 shadow-lg">
      <div className="flex flex-wrap items-center gap-2 px-1 py-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={fileActions.openFileDialog}
          disabled={uploading}
        >
          <UploadIcon className="size-4" />
          {uploading ? `Uploading ${uploadingName}…` : "Attach a file"}
        </Button>
        <input
          {...fileActions.getInputProps()}
          className="sr-only"
          aria-label={`${question.label || "File"} upload`}
        />
        <span className="text-xs text-muted-foreground">
          {placeholderLabel} up to {maxFileSizeMb}MB
        </span>
      </div>
      {error ? <p className="mt-1 px-2 text-xs text-destructive">{error}</p> : null}
      {canSkip && (
        // Disabled mid-upload so a Skip can't race an in-flight upload into a
        // double-advance (the upload runs while phase is still "ready").
        <button
          type="button"
          onClick={onSkip}
          disabled={uploading}
          className="mt-2 px-1 text-xs text-muted-foreground underline disabled:opacity-50"
        >
          {skipLabel}
        </button>
      )}
    </div>
  );
};

// AI prose can contain Markdown (links, inline `code`, bold). Render it so URLs
// and emails auto-link and code/emphasis show properly, instead of raw text.
const MARKDOWN_COMPONENTS: Components = {
  // AI-suggested links open in a new tab so the Respondent never loses the form.
  a: ({ children, node: _node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

// Chat bubbles only ever need lightweight inline Markdown — links, inline
// `code`, bold/italic/strikethrough, and simple lists. Everything else
// (headings, images, tables, code blocks, blockquotes, mermaid diagrams) is
// disallowed and unwrapped to its text, so nothing heavy renders in a bubble.
const CHAT_MARKDOWN_ALLOWED_ELEMENTS = [
  "p",
  "br",
  "a",
  "strong",
  "em",
  "del",
  "code",
  "ul",
  "ol",
  "li",
] as const;

const ChatMarkdown = ({ text, className }: { text: string; className?: string }) => (
  // `static` mode: bubbles render complete strings (generateText), not streams.
  <Streamdown
    mode="static"
    controls={false}
    allowedElements={CHAT_MARKDOWN_ALLOWED_ELEMENTS}
    unwrapDisallowed
    components={MARKDOWN_COMPONENTS}
    className={cn(
      // One short bubble: drop default block margins, inherit the bubble's
      // size/color, lightly style inline code.
      "[&_:first-child]:mt-0 [&_:last-child]:mb-0 [&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_li]:my-0 [&_ol]:my-1 [&_p]:my-0 [&_p+p]:mt-1.5 [&_ul]:my-1",
      className,
    )}
  >
    {text}
  </Streamdown>
);

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
    onTrip,
    onSubmit,
    onAnswersChange,
    isPreview,
    initialAnswers,
    shortId,
  } = props;

  const t = useMemo(() => getTranslations(settings.language ?? "English"), [settings.language]);

  // Resume-after-refresh: persist Answers to localStorage (same `betterforms_<formId>`
  // store the standard form uses) so a reload restores progress instead of starting
  // over — the AI then shows a recap and continues. Gated by `saveAnswersForLater`.
  const { loadSavedData, saveData, clearSavedData } = useFormPersistence(
    formId,
    settings.saveAnswersForLater,
  );
  // Read saved progress ONCE on mount. A server-provided draft (published form)
  // takes precedence over the localStorage cache.
  const [resumedAnswers] = useState<Record<string, unknown> | undefined>(
    () => initialAnswers ?? loadSavedData() ?? undefined,
  );
  const handleAnswersChange = useCallback(
    (next: Record<string, unknown>) => {
      saveData(next);
      onAnswersChange?.(next);
    },
    [saveData, onAnswersChange],
  );
  const handleFinalSubmit = useCallback(
    async (answers: Record<string, unknown>) => {
      clearSavedData();
      await onSubmit(answers);
    },
    [clearSavedData, onSubmit],
  );

  const session = useAiChatSession({
    formId,
    submissionId,
    content,
    settings,
    isPreview,
    initialAnswers: resumedAnswers,
    onAnswersChange: handleAnswersChange,
    onSubmit: handleFinalSubmit,
    // A trip defaults to the same handler as the manual switch, but callers
    // (e.g. the editor preview) can override it to NOT swap to the standard form.
    onTrip: onTrip ?? onSwitchToStandard,
  });

  const transcriptRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  // Object URLs minted for preview-mode file picks; revoked on unmount so they
  // don't leak across a builder's editing session.
  const previewObjectUrlsRef = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of previewObjectUrlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

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
  // While the AI is composing we keep the input visible (stable layout) but
  // disabled, rather than hiding it. `awaitingInput` covers both phases so the
  // composer stays mounted; `isBusy` drives the disabled state.
  const isBusy = session.phase === "loading";
  const awaitingInput = session.phase === "ready" || session.phase === "loading";

  const handleSubmit = useCallback(async () => {
    const text = draft;
    setDraft("");
    await session.submitFreeText(text);
  }, [draft, session]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!currentQ || currentQ.fieldType !== "FileUpload") return;
      const contentType = file.type || "application/octet-stream";

      // Editor preview never hits the upload endpoint (the draft form has no
      // upload token), so fake the upload with a local object URL — same as the
      // standard FileUploadField's preview path. Lets the builder test the flow.
      if (isPreview) {
        const previewUrl = URL.createObjectURL(file);
        previewObjectUrlsRef.current.push(previewUrl);
        await session.pickStructured(
          { url: previewUrl, name: file.name, size: file.size, type: contentType },
          file.name,
        );
        return;
      }

      // Errors propagate to FileUploadComposer, which surfaces them and lets the
      // Respondent retry. Failures don't advance the Question or burn AI cost.
      const blob = await upload(`submissions/${formId}/${submissionId}/${file.name}`, file, {
        access: "public",
        contentType,
        handleUploadUrl: "/api/forms/upload",
        clientPayload: JSON.stringify({
          formId,
          draftId: submissionId,
          fieldName: currentQ.name,
        }),
      });
      const uploaded: UploadedFormFile = {
        url: blob.url,
        name: file.name,
        size: file.size,
        type: contentType,
      };
      await session.pickStructured(uploaded, file.name);
    },
    [currentQ, formId, isPreview, session, submissionId],
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

      {/* Outer div is the full-width scroll container so the scrollbar sits at
          the pane edge; the inner div centers content to the same max-width as
          the composer below. */}
      <div
        ref={transcriptRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-4 pb-6">
          {session.bubbles.map((b) => {
            if (b.kind === "ai") {
              return (
                <div key={b.id} className="max-w-[80%] rounded-2xl bg-muted px-4 py-2 text-sm">
                  <ChatMarkdown text={b.prompt} />
                </div>
              );
            }
            if (b.kind === "ack") {
              return (
                <div
                  key={b.id}
                  className="max-w-[80%] rounded-2xl bg-muted/60 px-4 py-1.5 text-xs text-muted-foreground italic"
                >
                  <ChatMarkdown text={b.text} />
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
      </div>

      {awaitingInput && currentIsFreeText && (
        <FloatingPanel>
          <fieldset disabled={isBusy} className="contents">
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
          </fieldset>
        </FloatingPanel>
      )}

      {awaitingInput && currentIsStructured && currentQ && (
        <FloatingPanel>
          <fieldset disabled={isBusy} className="contents">
            <div className="rounded-2xl border border-border bg-card p-3 shadow-lg">
              {/* key resets per-Question local state (picked/order) — the composer
                  stays mounted across Questions now (awaitingInput), so without a
                  key the previous Question's selections would leak forward. */}
              <QuestionBubble
                key={currentQ.id}
                question={currentQ}
                onPick={(value, label) => session.pickStructured(value, label)}
                onSkip={canSkip ? () => void session.requestSkip() : undefined}
                canSkip={canSkip}
              />
            </div>
          </fieldset>
        </FloatingPanel>
      )}

      {awaitingInput && currentQ?.fieldType === "FileUpload" && (
        <FloatingPanel>
          <fieldset disabled={isBusy} className="contents">
            <FileUploadComposer
              key={currentQ.id}
              question={currentQ}
              onPickFile={handleFile}
              onSkip={canSkip ? () => void session.requestSkip() : undefined}
              canSkip={canSkip}
              skipLabel={t.aiChatSkipped}
            />
          </fieldset>
        </FloatingPanel>
      )}

      {session.phase === "submitting" && <FloatingMessage muted>{t.submitting}</FloatingMessage>}

      {session.phase === "closed" && (
        <FloatingPanel>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-3 text-center text-sm shadow-lg">
              {t.aiChatSubmitted}
            </div>
            {shortId && <FormShareCard shortId={shortId} />}
          </div>
        </FloatingPanel>
      )}

      {session.phase === "fallback" && (
        <FloatingMessage muted>
          {isPreview
            ? "AI Chat preview is unavailable right now — you may have reached today's preview limit, or the AI service is temporarily down. Your form still works for respondents."
            : t.aiChatUnavailable}
        </FloatingMessage>
      )}
    </div>
  );
};
