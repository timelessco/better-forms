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
import { createFileRoute, isRedirect, redirect, useLocation } from "@tanstack/react-router";
import { format } from "date-fns";
import { Loader2Icon } from "@/components/ui/icons";
import type { Value } from "platejs";
import { Activity, Suspense, lazy } from "react";
import * as v from "valibot";
import { coercedBooleanWithCatch, coercedNumberWithCatch } from "@/lib/valibot-search";
import EditorApp from "../-components/editor-app";

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

  const { previewMode } = useEditorSidebar();
  const formatDateTime = (dateString: string) => format(new Date(dateString), "MMM d, h:mm a");

  const versionContent = versionData?.content as Value | undefined;
  const versionCustomization = versionData?.customization as Record<string, unknown> | undefined;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <main className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-background">
        {isViewingVersion && (
          <div className="flex shrink-0 items-center justify-between border-b border-accent/20 bg-accent/50 px-4 py-2">
            <span className="text-accent-800 text-sm">
              {isLoadingVersionContent ? (
                <span className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading version…
                </span>
              ) : versionData?.publishedAt ? (
                <>
                  Viewing version from{" "}
                  <span className="font-semibold">{formatDateTime(versionData.publishedAt)}</span>
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
          className={cn(
            "flex-1 overflow-x-hidden",
            previewMode ? "h-full overflow-hidden" : "overflow-y-auto",
          )}
        >
          {/* Mirror the editor side and keep PreviewMode mounted across toggles
              once the user has previewed at least once. Without this, every
              editor↔preview toggle unmounted the preview and wiped the
              in-progress respondent state (typed values, cleared values, added
              repeatable-field rows) — only past Continue-clicks survived
              because `useFormPersistence` only writes on step advance. */}
          <Activity mode={previewMode ? "visible" : "hidden"}>
            <PreviewMode formId={formId} workspaceId={workspaceId} />
          </Activity>
          {/* <Activity> keeps EditorApp fiber/Slate doc/DOM alive across preview toggles — fresh Plate mount (50+ elements, per-element effects) is ~600ms; only re-runs effects on hidden↔visible flip. */}
          <Activity mode={previewMode ? "hidden" : "visible"}>
            {isViewingVersion && isLoadingVersionContent ? (
              <div className="flex size-full items-center justify-center">
                <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
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
                  versionContent={isViewingVersion ? versionContent : undefined}
                  versionCustomization={isViewingVersion ? versionCustomization : undefined}
                  readOnly={isViewingVersion}
                />
              </Suspense>
            )}
          </Activity>
        </div>
      </main>
    </div>
  );
};

export const Route = createFileRoute(
  "/_authenticated/workspace/$workspaceId/form-builder/$formId/edit",
)({
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
    embedPopupTrigger: v.optional(v.fallback(v.picklist(["button", "auto", "scroll"]), "button")),
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
