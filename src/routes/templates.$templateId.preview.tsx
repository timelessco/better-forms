import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { FormPreviewFromPlate } from "@/components/form-components/form-preview-from-plate";
import { NotFound } from "@/components/ui/not-found";
import { buildTemplateContent, findTemplateMeta } from "@/lib/form-templates";
import type { FormTemplateId } from "@/lib/form-templates";
import { buildPublicFormSettings } from "@/types/form-settings";

const noop = async () => {};
const PREVIEW_SETTINGS = buildPublicFormSettings(undefined);

/**
 * Bare-bones template preview route — no header, no sidebar, no chrome.
 * Used by the screenshot generator script to capture clean template thumbnails.
 */
const TemplatePreviewOnly = () => {
  const { templateId } = Route.useParams();
  const template = findTemplateMeta(templateId);
  const content = useMemo(
    () => (template ? buildTemplateContent(template.id as FormTemplateId) : []),
    [template],
  );

  if (!template) return <NotFound />;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <div className="h-full w-full overflow-x-hidden overflow-y-auto">
        <div className="pb-16">
          <FormPreviewFromPlate
            content={content}
            title={template.label}
            onSubmit={noop}
            settings={PREVIEW_SETTINGS}
            layout="public"
            boundToParent
          />
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/templates/$templateId/preview")({
  loader: ({ params }) => {
    if (!findTemplateMeta(params.templateId)) throw notFound();
  },
  component: TemplatePreviewOnly,
  notFoundComponent: () => null,
});
