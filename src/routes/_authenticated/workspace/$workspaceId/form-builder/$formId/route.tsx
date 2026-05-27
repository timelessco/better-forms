import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { getFormListings, isInitialized } from "@/collections";
import { getFormVersionsQueryOption } from "@/lib/server-fn/form-versions";
import { getFormbyIdQueryOption, getFormStatus } from "@/lib/server-fn/forms";
import type { FormStatus } from "@/lib/server-fn/forms";
import {
  importCustomizeSidebar,
  importFormSettingsSidebar,
  importShareSummarySidebar,
} from "@/routes/_authenticated/-components/lazy-modules";
import { createFileRoute, isRedirect, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

const FormLayout = () => {
  const pathname = useLocation({ select: (s) => s.pathname });
  // Extract formId from pathname to ensure it's always current
  const formIdFromPath = pathname.split("/form-builder/")[1]?.split("/")[0] || "";
  const params = Route.useParams();
  const formId = formIdFromPath || params.formId;

  // Warm Settings/Share/Customize chunks so first open doesn't flash empty behind Suspense. Version History skipped — rare, lazy-on-click is fine.
  useEffect(() => {
    void importFormSettingsSidebar();
    void importShareSummarySidebar();
    void importCustomizeSidebar();
  }, []);

  // Hide header on edit route (editor has its own full-screen layout)
  const isEditRoute = pathname.includes("/form-builder/") && pathname.includes("/edit");
  if (isEditRoute) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Outlet key={formId} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <main className="relative min-h-0 min-w-0 flex-1 overflow-auto">
        <Outlet key={formId} />
      </main>
    </div>
  );
};

export const Route = createFileRoute("/_authenticated/workspace/$workspaceId/form-builder/$formId")(
  {
    ssr: false,
    beforeLoad: async ({ context, params, location }) => {
      const isExactParentRoute =
        location.pathname === `/workspace/${params.workspaceId}/form-builder/${params.formId}` ||
        location.pathname === `/workspace/${params.workspaceId}/form-builder/${params.formId}/`;

      if (isExactParentRoute) {
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
          // Fall through to default redirect to edit
        }

        if (status === "published") {
          throw redirect({
            to: "/workspace/$workspaceId/form-builder/$formId/submissions",
            params: { workspaceId: params.workspaceId, formId: params.formId },
          });
        }
        throw redirect({
          to: "/workspace/$workspaceId/form-builder/$formId/edit",
          params: { workspaceId: params.workspaceId, formId: params.formId },
        });
      }
    },
    loader: async ({ context, params }) => {
      // Skip server fetch if collection has this form (e.g. optimistic create/duplicate) — component reads useLiveQuery. Guard: collections may not be init yet (SSR/first load before parent layout).
      if (isInitialized()) {
        const cachedForm = getFormListings().get(params.formId);
        if (cachedForm?.content) return;
      }

      await Promise.all([
        context.queryClient.ensureQueryData(getFormbyIdQueryOption(params.formId)),
        context.queryClient.ensureQueryData(getFormVersionsQueryOption(params.formId)),
      ]);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    component: FormLayout,
    pendingComponent: Loader,
    errorComponent: ErrorBoundary,
    notFoundComponent: NotFound,
  },
);
