import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { ensureActiveOrgForWorkspace } from "@/lib/server-fn/org";

const WorkspaceLayout = () => {
  const { workspaceId } = Route.useParams();
  return <Outlet key={workspaceId} />;
};

export const Route = createFileRoute("/_authenticated/workspace/$workspaceId")({
  // Align the active org with this workspace's owning org BEFORE nested form loaders/actions run,
  // so plan gating + requireScopedForm write-scoping key off the right org for multi-org users.
  loader: ({ params }) => ensureActiveOrgForWorkspace({ data: params.workspaceId }),
  component: WorkspaceLayout,
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});
