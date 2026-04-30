import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { getFormListings, isInitialized } from "@/collections";
import { getFormVersions } from "@/lib/server-fn/form-versions";
import { getFormbyIdQueryOption, getFormStatus } from "@/lib/server-fn/forms";
import type { FormStatus } from "@/lib/server-fn/forms";
import { createFileRoute, isRedirect, Outlet, redirect, useLocation } from "@tanstack/react-router";

const FormLayout = () => {
  const { pathname } = useLocation();
  // Extract formId from pathname to ensure it's always current
  const formIdFromPath = pathname.split("/form-builder/")[1]?.split("/")[0] || "";
  const params = Route.useParams();
  const formId = formIdFromPath || params.formId;

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
    beforeLoad: async ({ context, params, location }) => {
      const isExactParentRoute =
        location.pathname === `/workspace/${params.workspaceId}/form-builder/${params.formId}` ||
        location.pathname === `/workspace/${params.workspaceId}/form-builder/${params.formId}/`;

      if (isExactParentRoute) {
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
          } else {
            throw redirect({
              to: "/workspace/$workspaceId/form-builder/$formId/edit",
              params: { workspaceId: params.workspaceId, formId: params.formId },
            });
          }
        } catch (error: unknown) {
          if (isRedirect(error)) {
            throw error;
          }
          throw redirect({
            to: "/workspace/$workspaceId/form-builder/$formId/edit",
            params: { workspaceId: params.workspaceId, formId: params.formId },
          });
        }
      }
    },
    loader: async ({ context, params }) => {
      // Skip server fetch if collection already has this form (e.g. after optimistic create/duplicate).
      // The component reads from useLiveQuery, so the optimistic data is sufficient.
      // Guard: collections may not be initialized yet (SSR or first load before parent layout runs).
      if (isInitialized()) {
        const cachedForm = getFormListings().get(params.formId);
        if (cachedForm?.content) return;
      }

      await Promise.all([
        context.queryClient.ensureQueryData(getFormbyIdQueryOption(params.formId)),
        context.queryClient.ensureQueryData({
          queryKey: ["form-versions", params.formId],
          queryFn: () =>
            getFormVersions({ data: { formId: params.formId } }).then((r) => r.versions),
          staleTime: 1000 * 60 * 5,
        }),
      ]);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    component: FormLayout,
    ssr: false,
    pendingComponent: Loader,
    errorComponent: ErrorBoundary,
    notFoundComponent: NotFound,
  },
);
