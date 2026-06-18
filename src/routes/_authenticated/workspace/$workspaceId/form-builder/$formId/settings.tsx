import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { SettingsPage as SettingsPageContent } from "@/components/form-builder/settings-page";
import { createFileRoute } from "@tanstack/react-router";

const SettingsPage = () => {
  const { formId } = Route.useParams();
  return <SettingsPageContent formId={formId} />;
};

export const Route = createFileRoute(
  "/_authenticated/workspace/$workspaceId/form-builder/$formId/settings",
)({
  component: SettingsPage,
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
  ssr: "data-only",
});
