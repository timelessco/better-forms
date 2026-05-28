import { useCallback } from "react";
import { createPublicSubmission } from "@/lib/server-fn/public-submissions";

const draftKey = (formId: string) => `bf-draft-${formId}`;
const draftDataKey = (formId: string) => `bf-draft-data-${formId}`;

/** Read persisted draftId, or generate+persist one. Ephemeral UUID fallback when localStorage unavailable (SSR, private mode). */
export const getOrCreateDraftId = (formId: string): string => {
  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    const existing = localStorage.getItem(draftKey(formId));
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(draftKey(formId), fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
};

export const readDraftId = (formId: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(draftKey(formId));
  } catch {
    return null;
  }
};

export const clearDraftId = (formId: string) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftKey(formId));
    localStorage.removeItem(draftDataKey(formId));
  } catch {
    // localStorage unavailable
  }
};

/** Local mirror of in-progress draft — read-path cache for resume prompt, no server roundtrip. Server keeps canonical row. */
export interface LocalDraft {
  data: Record<string, unknown>;
  lastStepReached: number | null;
  savedAt: number;
}

export const readLocalDraft = (formId: string): LocalDraft | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftDataKey(formId));
    if (!raw) return null;
    return JSON.parse(raw) as LocalDraft;
  } catch {
    return null;
  }
};

const writeLocalDraft = (formId: string, payload: LocalDraft): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(draftDataKey(formId), JSON.stringify(payload));
  } catch {
    // quota/private mode — server save still happened, just no local resume
  }
};

interface SaveDraftInput {
  values: Record<string, unknown>;
  lastStepReached: number;
}

/**
 * Stable saveDraft for a form. Skips server call when all values empty (no rows for focus+blur without typing).
 * Debounce handled upstream by TanStack Form onBlurDebounceMs — this just fires the request.
 */
export const useDraftAutoSave = (formId: string) => {
  const saveDraft = useCallback(
    async ({ values, lastStepReached }: SaveDraftInput) => {
      // Strip transient File/Blob — raw File lives one tick before upload listener swaps in URL; persisting serializes to `{}` and clobbers saved URL.
      const sanitized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (typeof File !== "undefined" && v instanceof File) continue;
        if (typeof Blob !== "undefined" && v instanceof Blob) continue;
        sanitized[k] = v;
      }

      const hasAnyValue = Object.values(sanitized).some((v) => {
        if (v == null) return false;
        if (typeof v === "string") return v.length > 0;
        if (Array.isArray(v)) return v.length > 0;
        return true;
      });
      if (!hasAnyValue) return;

      // Mirror locally first — tab closed mid-flight still leaves a resumable copy.
      writeLocalDraft(formId, {
        data: sanitized,
        lastStepReached,
        savedAt: Date.now(),
      });

      const draftId = getOrCreateDraftId(formId);
      try {
        await createPublicSubmission({
          data: {
            formId,
            data: sanitized,
            isCompleted: false,
            draftId,
            lastStepReached,
          },
        });
      } catch (err) {
        // Best-effort; never surface to user. Next blur/submit retries implicitly.
        console.error("[Reform] Draft autosave failed:", err);
      }
    },
    [formId],
  );

  return { saveDraft };
};
