import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { NotFound } from "@/components/ui/not-found";
import { useFormVersionContent } from "@/hooks/use-form-versions";
import { getFormListings } from "@/collections";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { useVersionHistorySidebar } from "@/hooks/use-version-history-sidebar";
import { getFormStatus } from "@/lib/server-fn/forms";
import type { FormStatus } from "@/lib/server-fn/forms";
import { cn } from "@/lib/utils";
import { createFileRoute, isRedirect, redirect, useLocation } from "@tanstack/react-router";
import { format } from "date-fns";
import { Loader2Icon } from "@/components/ui/icons";
import type { Value } from "platejs";
import { Suspense, lazy } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";

const EditorApp = lazy(() => import("../-components/editor-app"));
const PreviewMode = lazy(() =>
  import("../-components/preview-mode").then((m) => ({ default: m.PreviewMode })),
);

const DesignPage = () => {
  const { pathname } = useLocation();
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
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Loading version...
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
          {previewMode ? (
            <PreviewMode formId={formId} workspaceId={workspaceId} />
          ) : isViewingVersion && isLoadingVersionContent ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
        </div>
      </main>
    </div>
  );
};

export const Route = createFileRoute(
  "/_authenticated/workspace/$workspaceId/form-builder/$formId/edit",
)({
  validateSearch: zodValidator(
    z.object({
      force: z.boolean().optional(),
      embedType: z.enum(["standard", "popup", "fullpage"]).catch("standard").optional(),
      embedHeight: z.coerce.number().catch(558).optional(),
      embedDynamicHeight: z.coerce.boolean().catch(true).optional(),
      embedDynamicWidth: z.coerce.boolean().catch(false).optional(),
      embedHideTitle: z.coerce.boolean().catch(false).optional(),
      embedAlignLeft: z.coerce.boolean().catch(false).optional(),
      embedTransparent: z.coerce.boolean().catch(false).optional(),
      embedBranding: z.coerce.boolean().catch(true).optional(),
      embedPopupPosition: z
        .enum(["bottom-right", "bottom-left", "center"])
        .catch("bottom-right")
        .optional(),
      embedPopupWidth: z.coerce.number().catch(376).optional(),
      embedDarkOverlay: z.coerce.boolean().catch(false).optional(),
      embedEmoji: z.coerce.boolean().catch(true).optional(),
      embedEmojiIcon: z.string().catch("\uD83D\uDC4B").optional(),
      embedEmojiAnimation: z.enum(["wave", "bounce", "pulse"]).catch("wave").optional(),
      embedPopupTrigger: z.enum(["button", "auto", "scroll"]).catch("button").optional(),
      embedHideOnSubmit: z.coerce.boolean().catch(false).optional(),
      embedHideOnSubmitDelay: z.coerce.number().catch(0).optional(),
    }),
  ),
  // Redirect published forms to submissions (prevents flash of editor)
  beforeLoad: async ({ context, params, search }) => {
    if (search.force === true) return;

    try {
      const cachedForm = getFormListings().get(params.formId);
      let status = cachedForm?.status as FormStatus | undefined;

      if (!status) {
        status = await getFormStatus(context.queryClient, params.formId);
      }

      if (status === "published") {
        throw redirect({
          to: "/workspace/$workspaceId/form-builder/$formId/submissions",
          params: { workspaceId: params.workspaceId, formId: params.formId },
        });
      }
    } catch (error: unknown) {
      if (isRedirect(error)) {
        throw error;
      }
      // On error, allow edit route to load
    }
  },
  ssr: "data-only",
  component: DesignPage,
  pendingComponent: () => <div>Loading...</div>,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});
