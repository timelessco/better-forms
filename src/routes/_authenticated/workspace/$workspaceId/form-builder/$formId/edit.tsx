import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { NotFound } from "@/components/ui/not-found";
import { useFormVersionContent } from "@/hooks/use-form-versions";
import { getFormListings } from "@/collections";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { useVersionHistorySidebar } from "@/hooks/use-version-history-sidebar";
import { getFormStatus } from "@/lib/server-fn/forms-queries";
import type { FormStatus } from "@/lib/server-fn/forms-queries";
import { cn } from "@/lib/utils";
import { startScopedViewTransition } from "@/lib/view-transition";
import { createFileRoute, isRedirect, redirect, useLocation } from "@tanstack/react-router";
import { format } from "date-fns";
import { Loader2Icon } from "@/components/ui/icons";
import type { Value } from "platejs";
import { Activity, Suspense, lazy, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import * as v from "valibot";
import { coercedBooleanWithCatch, coercedNumberWithCatch } from "@/lib/valibot-search";
import EditorApp from "../-components/editor-app";
// Eager import — lazy-loading this on first preview click pulls vaul-base into a Vite
// dep re-optimize that full-reloads the page (same class of bug as codeSplitGroupings below).
import { PreviewDrawer } from "../-components/preview-drawer";

const PreviewMode = lazy(() =>
  import("../-components/preview-mode").then((m) => ({ default: m.PreviewMode })),
);

const DesignPage = () => {
  const pathname = useLocation({ select: (s) => s.pathname });
  // Extract formId from pathname to ensure it's always current
  const formIdFromPath = pathname.split("/form-builder/")[1]?.split("/")[0] || "";
  const params = Route.useParams();
  const { workspaceId } = params;
  const formId = formIdFromPath || params.formId;

  const { selectedVersionId, isViewingVersion, exitVersionView } = useVersionHistorySidebar();

  const { data: versionContentDataArray, isLoading: isLoadingVersionContent } =
    useFormVersionContent(isViewingVersion ? (selectedVersionId ?? undefined) : undefined);

  const versionData = versionContentDataArray?.[0];

  const { previewMode, activeSidebar, exitPreview } = useEditorSidebar();
  // Share keeps the inline side-by-side preview pane; every other preview entry
  // (play button / hotkey) opens the full-page drawer instead.
  const isSharePreview = previewMode && activeSidebar === "share";
  const isDrawerPreview = previewMode && activeSidebar !== "share";
  const formatDateTime = (dateString: string) => format(new Date(dateString), "MMM d, h:mm a");

  const versionContent = versionData?.content as Value | undefined;
  const versionCustomization = versionData?.customization as Record<string, unknown> | undefined;

  // Smoothly cross-fade version enter/switch/exit instead of an instant jump — same view-transition
  // approach as the share preview tabs. The content swap is render-time + async (content loads after
  // the click), so we hold a COMMITTED snapshot and only advance it inside startViewTransition+
  // flushSync, forcing EditorApp's remount to happen within the transition (browser captures
  // before/after and cross-fades). We commit only TERMINAL states (editing, or a fully-loaded
  // version) — while a version is still loading the previous committed content stays on screen for
  // continuity, so there's a single cross-fade to the final content (no intermediate spinner flash).
  // The banner reflects the LIVE loading state so the user gets immediate feedback.
  const versionReady = isViewingVersion && !isLoadingVersionContent && versionContent !== undefined;
  const desired = {
    viewing: isViewingVersion,
    content: versionReady ? versionContent : undefined,
    customization: versionReady ? versionCustomization : undefined,
    publishedAt: versionReady ? versionData?.publishedAt : undefined,
  };
  const canCommit = !isViewingVersion || versionReady;
  const [committed, setCommitted] = useState(desired);
  const committedRef = useRef(committed);
  useEffect(() => {
    if (!canCommit) return;
    const c = committedRef.current;
    const unchanged =
      c.viewing === desired.viewing &&
      c.content === desired.content &&
      c.customization === desired.customization &&
      c.publishedAt === desired.publishedAt;
    if (unchanged) return;
    // Scoped: only the named "editor-content" group cross-fades; sidebars/header/version panel
    // hold static. flushSync forces EditorApp's render-time remount to happen inside the transition.
    startScopedViewTransition(() =>
      flushSync(() => {
        committedRef.current = desired;
        setCommitted(desired);
      }),
    );
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- desired is a fresh object each render; compare fields via committedRef instead
  }, [canCommit, desired.viewing, desired.content, desired.customization, desired.publishedAt]);

  // Banner follows live state (immediate feedback) but lingers through the exit cross-fade while
  // the committed content is still the version being faded out.
  const showVersionBanner = isViewingVersion || committed.viewing;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <main className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-background">
        {showVersionBanner && (
          <div className="flex shrink-0 items-center justify-between border-b border-accent/20 bg-accent/50 px-4 py-2">
            <span className="text-accent-800 text-sm">
              {isLoadingVersionContent ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading version…
                </span>
              ) : committed.publishedAt ? (
                <>
                  Viewing version from{" "}
                  <span className="font-semibold">{formatDateTime(committed.publishedAt)}</span>
                </>
              ) : (
                "Viewing version..."
              )}
            </span>
            <Button variant="outline" size="sm" onClick={exitVersionView}>
              Return to editing
            </Button>
          </div>
        )}

        <div
          data-editor-scroll
          data-bf-cover-pane
          className={cn(
            "flex-1 overflow-x-hidden",
            isSharePreview ? "h-full overflow-hidden" : "overflow-y-auto",
          )}
        >
          {/* Mirror the editor side and keep PreviewMode mounted across toggles
              once the user has previewed at least once. Without this, every
              editor↔preview toggle unmounted the preview and wiped the
              in-progress respondent state (typed values, cleared values, added
              repeatable-field rows) — only past Continue-clicks survived
              because `useFormPersistence` only writes on step advance. */}
          <Activity mode={isSharePreview ? "visible" : "hidden"}>
            <PreviewMode formId={formId} workspaceId={workspaceId} />
          </Activity>
          {/* <Activity> keeps EditorApp fiber/Slate doc/DOM alive across preview toggles — fresh Plate mount (50+ elements, per-element effects) is ~600ms; only re-runs effects on hidden↔visible flip. */}
          <Activity mode={isSharePreview ? "hidden" : "visible"}>
            {/* Stable named box so version enter/switch/exit cross-fades (driven by the committed
                snapshot above) instead of jumping. Mirrors the share preview's "preview-content".
                No loading spinner here — the previous committed content stays put during load. */}
            <div className="min-h-full" style={{ viewTransitionName: "editor-content" }}>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                }
              >
                <EditorApp
                  key={formId}
                  formId={formId}
                  workspaceId={workspaceId}
                  versionContent={committed.viewing ? committed.content : undefined}
                  versionCustomization={committed.viewing ? committed.customization : undefined}
                  readOnly={committed.viewing}
                />
              </Suspense>
            </div>
          </Activity>
        </div>

        <PreviewDrawer open={isDrawerPreview} onClose={exitPreview}>
          <PreviewMode formId={formId} workspaceId={workspaceId} />
        </PreviewDrawer>
      </main>
    </div>
  );
};

export const Route = createFileRoute(
  "/_authenticated/workspace/$workspaceId/form-builder/$formId/edit",
)({
  // Opt out of auto code-splitting: keep component inline (no ?tsr-split=component
  // chunk). Editor's platejs graph triggers a Vite dep re-optimize mid-nav that
  // kills the in-flight lazy chunk ("Failed to fetch dynamically imported module")
  // + other lazy-load bugs. Load eagerly instead.
  codeSplitGroupings: [],
  validateSearch: v.object({
    force: v.optional(v.boolean()),
    embedType: v.optional(v.fallback(v.picklist(["standard", "popup", "fullpage"]), "standard")),
    embedHeight: coercedNumberWithCatch(558),
    embedDynamicHeight: coercedBooleanWithCatch(true),
    embedDynamicWidth: coercedBooleanWithCatch(false),
    embedHideTitle: coercedBooleanWithCatch(false),
    embedAlignLeft: coercedBooleanWithCatch(false),
    embedTransparent: coercedBooleanWithCatch(false),
    embedBranding: coercedBooleanWithCatch(true),
    embedPopupPosition: v.optional(
      v.fallback(v.picklist(["bottom-right", "bottom-left", "center"]), "bottom-right"),
    ),
    embedPopupWidth: coercedNumberWithCatch(376),
    embedDarkOverlay: coercedBooleanWithCatch(false),
    embedEmoji: coercedBooleanWithCatch(true),
    embedEmojiIcon: v.optional(v.fallback(v.string(), "\uD83D\uDC4B")),
    embedEmojiAnimation: v.optional(v.fallback(v.picklist(["wave", "bounce", "pulse"]), "wave")),
    embedPopupTrigger: v.optional(
      v.fallback(v.picklist(["button", "auto", "scroll", "delay", "exit-intent"]), "button"),
    ),
    embedHideOnSubmit: coercedBooleanWithCatch(false),
    embedHideOnSubmitDelay: coercedNumberWithCatch(0),
  }),
  ssr: "data-only",
  // Redirect published forms to submissions (prevents flash of editor)
  beforeLoad: async ({ context, params, search }) => {
    if (search.force === true) return;

    let status: FormStatus | undefined;
    try {
      const cachedForm = getFormListings().get(params.formId);
      status = cachedForm?.status as FormStatus | undefined;

      if (!status) {
        status = await getFormStatus(context.queryClient, params.formId);
      }
    } catch (error: unknown) {
      if (isRedirect(error)) {
        throw error;
      }
      // On error, allow edit route to load
    }

    if (status === "published") {
      throw redirect({
        to: "/workspace/$workspaceId/form-builder/$formId/submissions",
        params: { workspaceId: params.workspaceId, formId: params.formId },
      });
    }
  },
  component: DesignPage,
  pendingComponent: () => <div>Loading…</div>,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});
