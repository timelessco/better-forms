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
import { useFormThemeContextValue } from "@/hooks/use-form-theme";
import { useForm } from "@/hooks/use-live-hooks";
import { useResolvedTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Loader2Icon } from "@/components/ui/icons";
import { normalizeNodeId } from "platejs";
import type { TElement, Value } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import type { KeyboardEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
 * Outer: fetch data, guard editor render until collection loaded.
 * Split needed because hooks run regardless of early returns — else usePlateEditor gets DEFAULT_EDITOR_VALUE on first render and never updates (resetKey static).
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
      return <div className="flex size-full items-center justify-center">Loading editor…</div>;
    }
    // Still syncing → show spinner
    return (
      <div className="flex size-full items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
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

/** Inner: mounts only once data ready, so usePlateEditor gets real content on first call. */
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
  const { customization, hasCustomization, themeVars, effectiveTheme } = useFormCustomization(
    customizationDoc,
    resolvedAppTheme,
  );

  const skipSaveRef = useRef(false);
  const lastKnownContentRef = useRef<string | null>(null);
  const pendingValueRef = useRef<Value | null>(null);
  const headerVisibility = useEditorHeaderVisibilitySafe();
  const [resetKey, setResetKey] = useState(0);

  // Detect version transitions (enter/exit/switch). Render-time setState — same pattern as external change detector below.
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
      // Exiting version — don't reset yet; flag so external change detector resets once savedDocs ready.
      lastKnownContentRef.current = null;
      justExitedVersionRef.current = true;
    }
  }

  // Memoized on savedContent ref. Immer (TanStack DB) keeps unchanged-field refs, so customization-only mutation leaves content ref stable → no spurious resetKey bump / Plate remount loop.
  const savedContent = savedDocs?.[0]?.content;
  const contentStr = savedContent ? JSON.stringify(savedContent) : null;

  // Detect external content change (discard/restore/remote sync) → recreate editor. setState-during-render is documented React (aborts + re-renders). Skip while pending save — sync-back is our edit.
  if (!versionContent && contentStr !== null && !pendingValueRef.current) {
    if (lastKnownContentRef.current === null) {
      lastKnownContentRef.current = contentStr;
      // Force reset on return from version view so editor picks up (maybe restored) savedDocs content.
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

  // Initial content from liveQuery (single source of truth). ID normalization via NodeIdPlugin in EditorKit.
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

  useEffect(() => {
    editor.setOption(AIInputPlugin, "formId", formId);
  }, [editor, formId]);

  const debouncedSave = useDebouncedCallback(
    (val: Value) => {
      const headerNode =
        val.length > 0 && val[0]?.type === "formHeader"
          ? (val[0] as unknown as FormHeaderElementData)
          : null;

      const collection = getFormListings();
      if (!collection.get(formId)) return; // Not in collection yet — next onChange will retry

      // Update ref so external-change detection sees upcoming sync-back as our edit.
      lastKnownContentRef.current = JSON.stringify(val);
      pendingValueRef.current = null;

      collection.update(formId, (draft) => {
        draft.content = val;
        if (workspaceId) draft.workspaceId = workspaceId;
        // No optimistic updatedAt bump: sidebar projects/sorts by updatedAt, so bumping it per
        // keystroke reshuffles + re-renders the whole sidebar. Server stamps updatedAt (updateForm);
        // recency reconciles on refetch. Content isn't projected, so this leaves sidebar rows stable.
        if (headerNode) {
          if (headerNode.title !== undefined) draft.title = headerNode.title;
          if (headerNode.icon !== undefined) draft.icon = headerNode.icon ?? null;
          if (headerNode.cover !== undefined) draft.cover = headerNode.cover ?? null;
        }
      });
    },
    { wait: 500 },
  );

  const persistEditorValue = useCallback(
    ({ value }: { value: Value }) => {
      if (readOnly) return;

      if (skipSaveRef.current) {
        skipSaveRef.current = false;
        return;
      }

      // Plate fires onChange on selection/focus too (color picker, popover) with same content. Skip save when unchanged — avoids roundtrip for a pure updatedAt bump.
      const serialized = JSON.stringify(value);
      if (serialized === lastKnownContentRef.current) return;

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

  // Lets the (out-of-editor) Customize sidebar set the header cover/logo on the Plate formHeader node.
  const updateHeaderMedia = useCallback(
    (field: "icon" | "cover", value: string | null) => {
      if (readOnly) return;
      const headerNode = editor.children[0];
      if (!headerNode || headerNode.type !== "formHeader") return;
      const path = editor.api.findPath(headerNode);
      if (path) editor.tf.setNodes({ [field]: value }, { at: path });
    },
    [editor, readOnly],
  );

  const themeCtx = useFormThemeContextValue({
    themeVars,
    hasCustomization,
    customization,
    updateThemeColor,
    updateHeaderMedia,
  });

  return (
    <EditorThemeProvider value={themeCtx}>
      <div
        className={cn(
          "min-h-full w-full overflow-x-hidden bg-background text-foreground",
          hasCustomization && "bf-themed",
          effectiveTheme === "dark" ? "dark" : "bf-light",
        )}
        style={hasCustomization ? themeVars : undefined}
      >
        <PlateEditorTree
          editor={editor}
          readOnly={readOnly}
          onChange={persistEditorValue}
          onKeyDown={handleEditorKeyDown}
        />
      </div>
    </EditorThemeProvider>
  );
};

// Memoized Plate subtree. Customization re-renders of EditorAppInner (theme vars, dark flips) update the wrapper but stop here — plugins don't see them, no useEffect mount/unmount thrash or update-depth limit on color-picker drags.
const PlateEditorTree = memo(
  ({
    editor,
    readOnly,
    onChange,
    onKeyDown,
  }: {
    editor: ReturnType<typeof usePlateEditor>;
    readOnly: boolean;
    onChange: (args: { value: Value }) => void;
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  }) => (
    <Plate editor={editor} readOnly={readOnly} onChange={onChange}>
      <EditorContainer
        variant="default"
        className="max-w-full overflow-y-visible border-none px-0 shadow-none sm:px-0"
      >
        <Editor variant="demo" className="rounded-none" onKeyDown={onKeyDown} />
      </EditorContainer>
    </Plate>
  ),
);
PlateEditorTree.displayName = "PlateEditorTree";
