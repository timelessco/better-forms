"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { valibotSchema } from "@ai-sdk/valibot";
import { useMutation } from "@tanstack/react-query";
import { PathApi } from "platejs";
import type { TElement } from "platejs";
import type { PlateEditor } from "platejs/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AI_DIFF_KEY } from "@/components/editor/plugins/ai-diff-kit";
import { toast } from "sonner";
import { applyOp, canLiveUpdate, liveUpdateOp } from "@/lib/editor/apply-op";
import type { AppliedOp, ApplyContext } from "@/lib/editor/apply-op";
import { mergeThemeIntoCustomization } from "@/lib/editor/merge-theme";
import { settingsDialogStore } from "@/hooks/use-settings-dialog";
import { FREE_CUSTOMIZATION_KEYS } from "@/lib/server-fn/plan-helpers";
import { AI_DAILY_LIMIT_ERROR } from "@/lib/server-fn/ai-quota-constants";
import { parseError } from "@/lib/errors/parse";
import { formGenSchema, isOpReady } from "@/lib/ai/ops-schema";
import type { FormGenResult, Op, PartialOp, SetThemeOp } from "@/lib/ai/ops-schema";

// Flat customization dict from server (theme-mode). Pro: light:*/dark:* tokens + font/radius; free: basic Theme keys. Spread into formDoc.customization either way.
type ThemePayload = Record<string, string>;

type UseObjectReturn = {
  object: Partial<FormGenResult> | undefined;
  submit: (input: SubmitInput) => void;
  isLoading: boolean;
  error: Error | undefined;
  stop: () => void;
};

export type ImagePart = { url: string; name: string };

const ADDITIVE_INTENT_PATTERN =
  /\b(add|append|insert|include|introduce|attach|create another|one more|another|additional|extra|more (steps?|pages?|sections?|fields?|questions?|options?))\b/i;

const REPLACE_OVERRIDE_PATTERN =
  /\b(replace|change|update|fix|edit|rewrite|modify|swap|convert)\b/i;

// Append (preserve selected) vs replace (delete + substitute). Replace verbs override additive ones.
const detectIntent = (prompt: string): "append" | "replace" => {
  if (REPLACE_OVERRIDE_PATTERN.test(prompt)) return "replace";
  if (ADDITIVE_INTENT_PATTERN.test(prompt)) return "append";
  return "replace";
};

type UIMessagePart =
  | { type: "text"; text: string }
  | { type: "file"; mediaType: string; url: string; filename: string };

type UIMessage = {
  id: string;
  role: "user";
  parts: UIMessagePart[];
};

type SubmitInput = {
  messages: UIMessage[];
  editorContent?: string;
  selectionContext?: string;
  mode?: "create" | "append" | "replace" | "theme";
};

const THEME_INTENT_PATTERN =
  /\b(theme|colors?|palette|style|look\s+like|use\s+(this|that|it)\s+as|reference|inspired\s+by|match\s+(this|that|it))\b/i;

// Form-building verbs → wants more than a theme change.
const FORM_BUILDING_PATTERN =
  /\b(create\s+(a|an|the)\s+(form|page|field|section|application|survey)|build\s+(a|an|the)|generate\s+(a|an|the)\s+(form|page|field|section)|add\s+(a|an|the)?\s*(field|page|step|section)|make\s+(a|an|the)\s+(form|page|application))\b/i;

const buildUserMessage = (prompt: string, images?: ImagePart[]): UIMessage => {
  const parts: UIMessagePart[] = [{ type: "text", text: prompt }];
  for (const image of images ?? []) {
    const mediaType = image.url.split(";")[0]?.split(":")[1] ?? "image/png";
    parts.push({
      type: "file",
      mediaType,
      url: image.url,
      filename: image.name,
    });
  }
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts,
  };
};

export type UseFormGenStreamOptions = {
  editor: PlateEditor;
  formId: string;
  getCapturedPath: () => number[];
  getEditorContent: () => string;
  getSelectionContext?: () => string | null;
  /** Block-selected node paths. Non-empty → submit enters edit mode: selected blocks removed, new ops inserted in place. */
  getSelectedBlockPaths?: () => number[][];
  onFinish?: () => void;
  onError?: (message: string) => void;
};

export const useFormGenStream = ({
  editor,
  formId,
  getCapturedPath,
  getEditorContent,
  getSelectionContext,
  getSelectedBlockPaths,
  onFinish,
  onError,
}: UseFormGenStreamOptions) => {
  const appliedRef = useRef<Map<number, AppliedOp>>(new Map());
  const initialPathRef = useRef<number[]>([]);
  const firstOpRef = useRef(true);
  const editModeRef = useRef(false);
  const createModeRef = useRef(false);
  const nextInsertPathRef = useRef<number[]>([]);
  const insertedCountRef = useRef(0);
  const settledRef = useRef(false);
  const thankYouEmittedRef = useRef(false);
  const firstContentSeenRef = useRef(false);
  // High-water mark: indices below are frozen (no live-update); apply loop starts here each tick.
  const frozenBelowRef = useRef(0);
  const lastInsertedPathRef = useRef<number[] | null>(null);

  const resetStreamState = useCallback(() => {
    appliedRef.current.clear();
    initialPathRef.current = [];
    firstOpRef.current = true;
    editModeRef.current = false;
    frozenBelowRef.current = 0;
    lastInsertedPathRef.current = null;
    createModeRef.current = false;
    nextInsertPathRef.current = [];
    insertedCountRef.current = 0;
    settledRef.current = false;
    thankYouEmittedRef.current = false;
    firstContentSeenRef.current = false;
  }, []);

  // Walk tree once, visit every block with aiDiff mark. Shared by accept and discard.
  const forEachDiffNode = useCallback(
    (visit: (node: Record<string, unknown>, path: number[]) => void) => {
      const entries = Array.from(
        editor.api.nodes({
          at: [],
          match: (n) => Boolean((n as Record<string, unknown>)[AI_DIFF_KEY]),
        }),
      ) as Array<[Record<string, unknown>, number[]]>;
      for (const [node, path] of entries) visit(node, path);
    },
    [editor],
  );

  /** Discard: remove every block marked `insert`; strip the `remove` mark. */
  const rollback = useCallback(() => {
    if (settledRef.current) return;
    const removePaths: number[][] = [];
    const stripPaths: number[][] = [];
    forEachDiffNode((node, path) => {
      const mark = (node as { aiDiff?: "insert" | "remove" }).aiDiff;
      if (mark === "insert") removePaths.push(path);
      else if (mark === "remove") stripPaths.push(path);
    });

    editor.tf.withoutNormalizing(() => {
      // Strip marks FIRST (paths valid pre-remove), then remove descending so earlier paths stay valid.
      for (const p of stripPaths) {
        try {
          editor.tf.unsetNodes(AI_DIFF_KEY, { at: p });
        } catch {
          // node moved; skip
        }
      }
      for (const p of removePaths.toSorted((a, b) => (b[0] ?? 0) - (a[0] ?? 0))) {
        try {
          editor.tf.removeNodes({ at: p });
        } catch {
          // path stale; skip
        }
      }
    });

    settledRef.current = true;
    resetStreamState();
  }, [editor, forEachDiffNode, resetStreamState]);

  /** Accept: remove every block marked `remove`; strip the `insert` mark. */
  const accept = useCallback(() => {
    if (settledRef.current) return;
    const removePaths: number[][] = [];
    const stripPaths: number[][] = [];
    forEachDiffNode((node, path) => {
      const mark = (node as { aiDiff?: "insert" | "remove" }).aiDiff;
      if (mark === "remove") removePaths.push(path);
      else if (mark === "insert") stripPaths.push(path);
    });

    editor.tf.withoutNormalizing(() => {
      for (const p of removePaths.toSorted((a, b) => (b[0] ?? 0) - (a[0] ?? 0))) {
        try {
          editor.tf.removeNodes({ at: p });
        } catch {
          // path stale; skip
        }
      }
      for (const p of stripPaths) {
        try {
          editor.tf.unsetNodes(AI_DIFF_KEY, { at: p });
        } catch {
          // node moved; skip
        }
      }
    });

    settledRef.current = true;
    resetStreamState();
  }, [editor, forEachDiffNode, resetStreamState]);

  const lastPromptRef = useRef<string>("");

  const { mutate: themeMutate, isPending: isThemeMutationPending } = useMutation({
    mutationFn: async (requestBody: unknown): Promise<ThemePayload> => {
      const res = await fetch("/api/ai/form-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) {
        // 429 = daily AI quota exhausted; structured body. Show rate-limit toast + Upgrade CTA.
        if (res.status === 429) {
          const body = (await res.json().catch(() => null)) as {
            message?: string;
            limit?: number;
          } | null;
          toast.error(body?.message || "Daily AI limit reached. Upgrade to Pro for unlimited.", {
            action: {
              label: "Upgrade to Pro",
              onClick: () => settingsDialogStore.open("billing"),
            },
          });
          throw new Error(body?.message || AI_DAILY_LIMIT_ERROR);
        }
        throw new Error(`theme request failed: ${res.status}`);
      }
      const data = (await res.json()) as { theme?: ThemePayload };
      if (!data.theme) throw new Error("no theme in response");
      return data.theme;
    },
    onSuccess: async (theme) => {
      if (!formId) {
        onFinish?.();
        return;
      }
      // Merge plan-aware customization dict onto existing, preset="custom" so picker reflects change.
      const collectionsModule = await import("@/collections");
      const localModule = await import("@/collections/local/form");

      const updateDraft = (draft: { customization?: unknown; updatedAt?: string }) => {
        const current = (draft.customization ?? {}) as Record<string, string>;
        draft.customization = mergeThemeIntoCustomization(current, theme);
        draft.updatedAt = new Date().toISOString();
      };

      const cloud = collectionsModule.getFormListings();
      if (cloud.get(formId)) {
        cloud.update(formId, updateDraft as never);
      } else if (localModule.localFormCollection.get(formId)) {
        localModule.localFormCollection.update(formId, updateDraft as never);
      }

      // All-free-key response → free tier; prompt upgrade. Pro (light:*/dark:* tokens) skips toast.
      const isFreeTierResponse = Object.keys(theme).every((k) => FREE_CUSTOMIZATION_KEYS.has(k));
      if (isFreeTierResponse) {
        toast("Theme applied. For full per-mode color customization, upgrade to Pro.", {
          action: {
            label: "Upgrade to Pro",
            onClick: () => settingsDialogStore.open("billing"),
          },
        });
      }

      onFinish?.();
    },
    onError: (err: Error) => {
      const parsed = parseError(err);
      onError?.(parsed.message || "Theme generation failed.");
    },
  });

  const applyFinalThemeOps = useCallback(
    (finalObject: { ops?: PartialOp[] } | undefined) => {
      const ops = finalObject?.ops;
      if (!ops || ops.length === 0) return;

      // Last set-theme op wins (AI may emit multiple).
      let themeOp: SetThemeOp | null = null;
      for (const partial of ops) {
        if (partial?.type !== "set-theme") continue;
        if (!isOpReady(partial)) continue;
        themeOp = partial;
      }
      if (!themeOp) return;

      const ctx: ApplyContext = {
        editor,
        initialPathRef,
        firstOpRef,
        editMode: editModeRef.current,
        createMode: createModeRef.current,
        nextInsertPathRef,
        formId,
        insertedCountRef,
        thankYouEmittedRef,
        firstContentSeenRef,
      };
      applyOp(themeOp, ctx);
    },
    [editor, formId],
  );

  const finalizeStream = useCallback(() => {
    if (!createModeRef.current) return;
    try {
      editor.tf.withoutNormalizing(() => {
        // 1. Default formHeader icon/cover if AI omitted them
        const header = editor.children[0] as Record<string, unknown> | undefined;
        if (header?.type === "formHeader") {
          const updates: Record<string, unknown> = {};
          if (!header.icon) updates.icon = "Document";
          if (!header.cover) updates.cover = "#1e293b";
          if (Object.keys(updates).length > 0) {
            editor.tf.setNodes(updates, { at: [0] });
          }
        }

        // 2. Prompt wanted thank-you message but AI emitted bare page-break w/ no content → inject default.
        const wantsThankYouMessage =
          /\bthank\s*you\b.*\b(message|with|saying|that\s*says|page\s*with)\b/i.test(
            lastPromptRef.current,
          ) ||
          /\bwith\s*(a\s*)?(message|note|confirmation)\s*(of|saying|that)/i.test(
            lastPromptRef.current,
          );

        if (wantsThankYouMessage) {
          const children = editor.children as Array<Record<string, unknown>>;
          const tyIdx = children.findIndex(
            (n) => n?.type === "pageBreak" && n.isThankYouPage === true,
          );
          if (tyIdx !== -1) {
            // Content already after thank-you page-break?
            const next = children[tyIdx + 1];
            const hasContent = next && /^h[1-3]$/.test(next.type as string);
            if (!hasContent) {
              const insertAt = [tyIdx + 1];
              editor.tf.insertNodes(
                {
                  type: "h1",
                  children: [{ text: "Thank You!" }],
                } as unknown as TElement,
                { at: insertAt },
              );
              editor.tf.insertNodes(
                {
                  type: "h3",
                  children: [
                    {
                      text: "Your submission has been received. We'll get back to you shortly.",
                    },
                  ],
                } as unknown as TElement,
                { at: [tyIdx + 2] },
              );
            }
          }
        }
      });
    } catch {
      // best-effort
    }
  }, [editor]);

  const hook = useObject({
    api: "/api/ai/form-generate",
    schema: valibotSchema(formGenSchema),
    onFinish: ({ object: finalObject }: { object: FormGenResult | undefined }) => {
      // Apply set-theme atomically once full theme arrived (skip partial-state churn while streaming).
      applyFinalThemeOps(finalObject);
      finalizeStream();
      onFinish?.();
      // rollback() needs insertedCountRef — reset happens on next submit/rollback.
    },
    onError: (err: Error) => {
      rollback();
      // Streaming path: useObject serializes 429 body into err.message as JSON. Parse for `code`; substring-sniff AI_DAILY_LIMIT_ERROR as back-compat fallback.
      const parsed = parseError(err);
      const msg = parsed.message ?? "";
      let bodyCode: string | undefined;
      try {
        const body = JSON.parse(msg) as { code?: unknown };
        if (typeof body?.code === "string") bodyCode = body.code;
      } catch {
        // err.message wasn't a JSON body (network error, abort, etc.)
      }
      const isDailyLimit =
        bodyCode === "quota/ai-daily-limit" ||
        parsed.code === "quota/ai-daily-limit" ||
        msg.includes(AI_DAILY_LIMIT_ERROR) ||
        msg.includes("Daily AI limit");
      if (isDailyLimit) {
        toast.error("Daily AI limit reached. Upgrade to Pro for unlimited generations.", {
          action: {
            label: "Upgrade to Pro",
            onClick: () => settingsDialogStore.open("billing"),
          },
        });
      }
      onError?.(msg || "Generation failed. Changes have been rolled back.");
    },
  }) as unknown as UseObjectReturn;

  const { object, submit: submitObject, isLoading, error, stop } = hook;

  // Apply/live-update ops as partial object streams. Synchronous, single Plate batch — prevents re-entrant fires double-applying same op index.
  useEffect(() => {
    if (!object?.ops) return;
    const ops = object.ops as PartialOp[];
    const ctx: ApplyContext = {
      editor,
      initialPathRef,
      firstOpRef,
      editMode: editModeRef.current,
      createMode: createModeRef.current,
      nextInsertPathRef,
      formId,
      insertedCountRef,
      thankYouEmittedRef,
      firstContentSeenRef,
    };

    let didInsert = false;
    editor.tf.withoutNormalizing(() => {
      // Below high-water mark = frozen. Only tail op (currently streaming) can live-update.
      const start = frozenBelowRef.current;
      for (let i = start; i < ops.length; i++) {
        const partial = ops[i];
        if (!isOpReady(partial)) continue;
        // set-theme is applied atomically in onFinish, not during streaming.
        if (partial?.type === "set-theme") continue;
        const op = partial as Op;
        const prev = appliedRef.current.get(i);
        if (!prev) {
          const applied = applyOp(op, ctx);
          if (applied) {
            appliedRef.current.set(i, applied);
            didInsert = true;
            if ("path" in applied && applied.path?.length) {
              lastInsertedPathRef.current = applied.path;
              // Mark inserted block(s) so AIDiff wrapper tints green. nodeCount = contiguous top-level blocks from path.
              const count = "nodeCount" in applied ? applied.nodeCount : 1;
              const startIdx = applied.path[0];
              if (typeof startIdx === "number") {
                for (let j = 0; j < count; j++) {
                  try {
                    editor.tf.setNodes({ [AI_DIFF_KEY]: "insert" }, { at: [startIdx + j] });
                  } catch {
                    // best-effort; skip missing node
                  }
                }
              }
            }
          }
        } else if (canLiveUpdate(op, prev)) {
          const updated = liveUpdateOp(op, prev, editor);
          appliedRef.current.set(i, updated);
        }
      }
      // Freeze everything except the tail op — it may still grow.
      frozenBelowRef.current = Math.max(0, ops.length - 1);
    });

    // Auto-scroll latest insertion into view. Inserts only, not live-updates — avoids jitter as label fills.
    if (didInsert && lastInsertedPathRef.current) {
      const path = lastInsertedPathRef.current;
      requestAnimationFrame(() => {
        try {
          const entry = editor.api.node(path);
          if (!entry) return;
          const domNode = (
            editor.api as unknown as { toDOMNode?: (node: unknown) => HTMLElement | undefined }
          ).toDOMNode?.(entry[0]);
          domNode?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch {
          // best-effort; ignore
        }
      });
    }
  }, [object, editor, formId]);

  // Rollback on error (additional safety beyond onError; adjust-during-render).
  const [lastError, setLastError] = useState(error);
  if (lastError !== error) {
    setLastError(error);
    if (error) rollback();
  }

  const submit = useCallback(
    (prompt: string, images?: ImagePart[]) => {
      const imageList = images ?? [];
      const selectedPaths = getSelectedBlockPaths?.() ?? [];
      const intent = selectedPaths.length > 0 ? detectIntent(prompt) : "append";
      const editMode = selectedPaths.length > 0 && intent === "replace";

      lastPromptRef.current = prompt;
      appliedRef.current.clear();
      insertedCountRef.current = 0;
      settledRef.current = false;
      firstOpRef.current = true;
      editModeRef.current = editMode;
      thankYouEmittedRef.current = false;
      firstContentSeenRef.current = false;
      frozenBelowRef.current = 0;
      lastInsertedPathRef.current = null;

      if (editMode) {
        // REPLACE: originals stay marked aiDiff='remove' (red), new blocks after last selected (green). Accept prunes originals; discard prunes new.
        const sortedAsc = [...selectedPaths].toSorted((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
        const lastPath = sortedAsc[sortedAsc.length - 1] ?? [
          Math.max(0, editor.children.length - 1),
        ];
        const insertAt = PathApi.next(lastPath);
        initialPathRef.current = [...insertAt];
        nextInsertPathRef.current = [...insertAt];

        editor.tf.withoutNormalizing(() => {
          for (const p of sortedAsc) {
            try {
              editor.tf.setNodes({ [AI_DIFF_KEY]: "remove" }, { at: p });
            } catch {
              // path stale; skip
            }
          }
        });
      } else {
        // APPEND/no-selection: leave existing blocks, insert fresh content.
        initialPathRef.current = getCapturedPath();
        nextInsertPathRef.current = [];
      }

      const selection = getSelectionContext?.() ?? undefined;
      const editorContent = getEditorContent();

      // Fresh form = only chrome (formHeader/formButton/pageBreak), zero content blocks. MarkdownPlugin serializes header title even when empty, so editorContent alone is unreliable.
      const CHROME_TYPES = new Set(["formHeader", "formButton", "pageBreak"]);
      const contentBlockCount = (editor.children as Array<Record<string, unknown>>).filter(
        (n) => !CHROME_TYPES.has(n?.type as string),
      ).length;
      const formIsEmpty = contentBlockCount === 0;

      // Theme mode = image + theme intent + no form-building verbs. Form+theme → fall back to create/append; AI can still emit set-theme as an op.
      const isThemeIntent =
        imageList.length > 0 &&
        THEME_INTENT_PATTERN.test(prompt) &&
        !FORM_BUILDING_PATTERN.test(prompt) &&
        !editMode;

      let mode: "create" | "append" | "replace" | "theme";
      if (isThemeIntent) mode = "theme";
      else if (editMode) mode = "replace";
      else if (formIsEmpty && selectedPaths.length === 0) mode = "create";
      else mode = "append";
      createModeRef.current = mode === "create";

      const requestBody = {
        messages: [buildUserMessage(prompt, imageList)],
        // Empty form has no useful context — saves input tokens on every create.
        ...(mode === "create" ? {} : { editorContent }),
        ...(selection ? { selectionContext: selection } : {}),
        mode,
      };

      // Theme mode bypasses useObject — server returns one-shot tool-call JSON, not a stream.
      if (mode === "theme") {
        themeMutate(requestBody);
        return;
      }

      submitObject(requestBody);
    },
    [
      submitObject,
      getCapturedPath,
      getEditorContent,
      getSelectionContext,
      getSelectedBlockPaths,
      editor,
      themeMutate,
    ],
  );

  return {
    submit,
    stop,
    rollback,
    accept,
    isLoading: isLoading || isThemeMutationPending,
    error,
  };
};
