import { log } from "evlog";
import { useCallback } from "react";
import { safeStorage } from "@/lib/safe-storage";
import { createPublicSubmission } from "@/lib/server-fn/public-submissions";

const draftKey = (formId: string) => `bf-draft-${formId}`;
const draftDataKey = (formId: string) => `bf-draft-data-${formId}`;

/** Read persisted draftId, or generate+persist one. Ephemeral UUID fallback when localStorage unavailable (SSR, private mode). */
export const getOrCreateDraftId = (formId: string): string => {
  const existing = safeStorage.get(draftKey(formId));
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  safeStorage.set(draftKey(formId), fresh); // no-op when storage unavailable — fresh id stays ephemeral
  return fresh;
};

export const readDraftId = (formId: string): string | null => safeStorage.get(draftKey(formId));

export const clearDraftId = (formId: string) => {
  safeStorage.remove(draftKey(formId));
  safeStorage.remove(draftDataKey(formId));
};

/** Local mirror of in-progress draft — read-path cache for resume prompt, no server roundtrip. Server keeps canonical row. */
export interface LocalDraft {
  data: Record<string, unknown>;
  lastStepReached: number | null;
  savedAt: number;
}

export const readLocalDraft = (formId: string): LocalDraft | null =>
  safeStorage.getJson<LocalDraft>(draftDataKey(formId));

// quota/private mode — no-op; server save still happened, just no local resume
const writeLocalDraft = (formId: string, payload: LocalDraft): void => {
  safeStorage.setJson(draftDataKey(formId), payload);
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
        log.error({ tag: "Reform", msg: "Draft autosave failed", error: err });
      }
    },
    [formId],
  );

  return { saveDraft };
};
