import { EditorKit } from "@/components/editor/editor-kit";
import { AIInputPlugin } from "@/components/editor/plugins/ai-input-kit";
import { Editor, EditorContainer } from "@/components/ui/editor";
import { createFormButtonNode } from "@/components/ui/form-button-node";
import type { FormHeaderElementData } from "@/components/ui/form-header-node";
import { createFormHeaderNode } from "@/components/ui/form-header-node";
import { migrateEditorContent } from "@/lib/editor/migrate-editor-content";
import { useEditorHeaderVisibilitySafe } from "@/contexts/editor-header-visibility-context";
import { EditorThemeProvider } from "@/contexts/editor-theme-context";
import { getFormListings } from "@/collections";
import type { Form } from "@/collections";
import { useFormCustomization } from "@/hooks/use-form-customization";
import { useForm } from "@/hooks/use-live-hooks";
import { useResolvedTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Loader2Icon } from "@/components/ui/icons";
import { normalizeNodeId } from "platejs";
import type { TElement, Value } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import type { KeyboardEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

interface EditorAppProps {
  formId: string;
  workspaceId?: string;
  defaultValue?: ReturnType<typeof normalizeNodeId>;
  initialForm?: unknown;
  versionContent?: Value;
  versionCustomization?: Record<string, unknown>;
  readOnly?: boolean;
}

const DEFAULT_EDITOR_VALUE = normalizeNodeId([
  createFormHeaderNode() as unknown as TElement,
  {
    children: [{ text: "" }],
    type: "p",
  },
  createFormButtonNode("submit") as unknown as TElement,
]);

/**
 * Outer component: fetches data and guards against rendering
 * the editor before the collection data has loaded.
 *
 * This split is necessary because React hooks always execute regardless
 * of early returns. Without it, `usePlateEditor` would be called with
 * DEFAULT_EDITOR_VALUE on the first render (while data is loading),
 * and the editor would never update because `resetKey` doesn't change.
 */
const EditorApp = ({
  formId,
  workspaceId,
  versionContent,
  versionCustomization,
  readOnly = false,
}: EditorAppProps) => {
  const { data: savedDocsRaw, isReady: isFormReady } = useForm(formId);
  // Query-backed FormDetail is structurally compatible with Form at runtime
  const savedDocs = savedDocsRaw as Form[] | undefined;

  // Guard: don't mount the editor until we have actual form content (not just listing metadata)
  if (!versionContent && (!savedDocs?.length || !savedDocs[0]?.content)) {
    // Collection ready but form not found → genuinely doesn't exist
    if (isFormReady) {
      return (
        <div className="flex h-full w-full items-center justify-center">Loading editor...</div>
      );
    }
    // Still syncing → show spinner
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <EditorAppInner
      formId={formId}
      workspaceId={workspaceId}
      versionContent={versionContent}
      versionCustomization={versionCustomization}
      readOnly={readOnly}
      savedDocs={savedDocs}
    />
  );
};
export default EditorApp;

/**
 * Inner component: only mounts once data is available.
 * `usePlateEditor` is guaranteed to receive real content from its first call.
 */
const EditorAppInner = ({
  formId,
  workspaceId,
  versionContent,
  versionCustomization,
  readOnly,
  savedDocs,
}: {
  formId: string;
  workspaceId?: string;
  versionContent?: Value;
  versionCustomization?: Record<string, unknown>;
  readOnly: boolean;
  savedDocs: Form[] | undefined;
}) => {
  const resolvedAppTheme = useResolvedTheme();

  const customizationDoc = versionCustomization
    ? { customization: versionCustomization }
    : savedDocs?.[0];
  const { customization, hasCustomization, themeVars } = useFormCustomization(
    customizationDoc,
    resolvedAppTheme,
  );

  const skipSaveRef = useRef(false);
  const lastKnownContentRef = useRef<string | null>(null);
  const pendingValueRef = useRef<Value | null>(null);
  const headerVisibility = useEditorHeaderVisibilitySafe();
  const [resetKey, setResetKey] = useState(0);

  // Detect version content transitions (enter/exit/switch version view).
  // Uses render-time setState — same pattern as the external change detector below.
  const prevVersionContentRef = useRef(versionContent);
  const justExitedVersionRef = useRef(false);
  if (prevVersionContentRef.current !== versionContent) {
    prevVersionContentRef.current = versionContent;
    if (versionContent) {
      // Entering or switching version — reset editor with version content immediately
      setResetKey((k) => k + 1);
      skipSaveRef.current = true;
      justExitedVersionRef.current = false;
    } else {
      // Exiting version view — don't reset yet. Mark that we exited so the
      // external change detector forces a reset once savedDocs is available.
      lastKnownContentRef.current = null;
      justExitedVersionRef.current = true;
    }
  }

  // Detect external content change (discard, restore, remote sync) and recreate editor.
  // setState during render is a documented React pattern — React aborts this
  // render and immediately re-renders with the new state.
  // Skip detection while we have a pending save — the sync-back is our own edit.
  if (!versionContent && savedDocs?.length && !pendingValueRef.current) {
    const contentStr = JSON.stringify(savedDocs[0]?.content);
    if (lastKnownContentRef.current === null) {
      lastKnownContentRef.current = contentStr;
      // Force reset when returning from version view so editor picks up
      // the (potentially restored) content from savedDocs
      if (justExitedVersionRef.current) {
        setResetKey((k) => k + 1);
        skipSaveRef.current = true;
        justExitedVersionRef.current = false;
      }
    } else if (lastKnownContentRef.current !== contentStr) {
      setResetKey((k) => k + 1);
      lastKnownContentRef.current = contentStr;
      skipSaveRef.current = true;
    }
  }

  // Compute initial content from liveQuery - single source of truth.
  // ID normalization is handled by NodeIdPlugin in EditorKit.
  const initialContent = useMemo(() => {
    if (versionContent) return versionContent;

    const docData = savedDocs?.[0];
    if (!docData?.content || !Array.isArray(docData.content)) {
      return DEFAULT_EDITOR_VALUE;
    }

    return migrateEditorContent(docData.content as Value, {
      title: docData.title,
      icon: docData.icon,
      cover: docData.cover,
    });
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- savedDocs intentionally excluded; resetKey triggers recompute
  }, [versionContent, resetKey]);

  const editor = usePlateEditor(
    {
      plugins: EditorKit,
      value: initialContent,
    },
    [resetKey],
  );

  editor.setOption(AIInputPlugin, "formId", formId);

  const debouncedSave = useDebouncedCallback(
    (val: Value) => {
      const headerNode =
        val.length > 0 && val[0]?.type === "formHeader"
          ? (val[0] as unknown as FormHeaderElementData)
          : null;

      const collection = getFormListings();
      if (!collection.get(formId)) return; // Not in collection yet — next onChange will retry

      // Update the ref so external-change detection recognizes
      // the upcoming sync-back as our own edit
      lastKnownContentRef.current = JSON.stringify(val);
      pendingValueRef.current = null;

      collection.update(formId, (draft) => {
        draft.content = val;
        if (workspaceId) draft.workspaceId = workspaceId;
        draft.updatedAt = new Date().toISOString();
        if (headerNode) {
          if (headerNode.title !== undefined) draft.title = headerNode.title;
          if (headerNode.icon !== undefined) draft.icon = headerNode.icon ?? null;
          if (headerNode.cover !== undefined) draft.cover = headerNode.cover ?? null;
        }
      });
    },
    { wait: 500 },
  );

  const handleChange = useCallback(
    ({ value }: { value: Value }) => {
      if (readOnly) return;

      if (skipSaveRef.current) {
        skipSaveRef.current = false;
        return;
      }

      pendingValueRef.current = value;
      debouncedSave(value);
    },
    [readOnly, debouncedSave],
  );

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (readOnly || !headerVisibility?.enabled) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key;
      const isPrintable = key.length === 1;
      const isTypingIntentKey =
        isPrintable ||
        key === "Enter" ||
        key === "Backspace" ||
        key === "Delete" ||
        key === " " ||
        key === "Spacebar";

      if (!isTypingIntentKey) return;
      headerVisibility.reportTyping();
    },
    [readOnly, headerVisibility],
  );

  const updateThemeColor = useCallback(
    (themeColor: string) => {
      if (!formId) return;
      const collection = getFormListings();
      if (!collection.get(formId)) return;
      collection.update(formId, (draft) => {
        const current = (draft.customization ?? {}) as Record<string, string>;
        draft.customization = { ...current, themeColor, preset: "custom" };
        draft.updatedAt = new Date().toISOString();
      });
    },
    [formId],
  );

  const themeCtx = useMemo(
    () => ({
      themeVars,
      hasCustomization: Boolean(hasCustomization),
      customization,
      updateThemeColor: hasCustomization ? updateThemeColor : undefined,
    }),
    [themeVars, hasCustomization, customization, updateThemeColor],
  );

  return (
    <EditorThemeProvider value={themeCtx}>
      <div
        className={cn(
          "min-h-full w-full overflow-x-hidden bg-background text-foreground",
          hasCustomization && "bf-themed",
          resolvedAppTheme === "dark" && "dark",
        )}
        style={hasCustomization ? themeVars : undefined}
      >
        <Plate editor={editor} readOnly={readOnly} onChange={handleChange}>
          <EditorContainer
            variant="default"
            className="max-w-full overflow-y-visible border-none px-0 shadow-none sm:px-0"
          >
            <Editor variant="demo" className="rounded-none" onKeyDown={handleEditorKeyDown} />
          </EditorContainer>
        </Plate>
      </div>
    </EditorThemeProvider>
  );
};
