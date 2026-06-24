import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { FormPreviewFromPlate } from "@/components/form-components/form-preview-from-plate";
import { NotFound } from "@/components/ui/not-found";
import { useCreateFromTemplate } from "@/hooks/use-create-from-template";
import {
  buildTemplateContent,
  findTemplateMeta,
  FORM_TEMPLATE_CATEGORY_LABEL,
} from "@/lib/form-templates";
import type { FormTemplateId } from "@/lib/form-templates";
import { buildPublicFormSettings } from "@/types/form-settings";

const noop = async () => {};
const PREVIEW_SETTINGS = buildPublicFormSettings(undefined);

const TemplatePreviewPage = () => {
  const { templateId } = Route.useParams();
  const { createFromTemplate, isCreating, hasWorkspace } = useCreateFromTemplate();

  const template = findTemplateMeta(templateId);
  const content = useMemo(
    () => (template ? buildTemplateContent(template.id as FormTemplateId) : []),
    [template],
  );

  if (!template) return <NotFound />;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground lg:flex-row lg:overflow-hidden">
      {/* Left: live read-only preview of the seeded form. */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-muted/30 px-4 py-8 md:px-8">
        <div className="bg-gray-0 mx-auto max-w-2xl rounded-[12px] border border-gray-100">
          <FormPreviewFromPlate
            content={content}
            title={template.label}
            cover={template.cover ?? undefined}
            onSubmit={noop}
            settings={PREVIEW_SETTINGS}
            layout="public"
            boundToParent
          />
        </div>
      </div>

      {/* Right: template metadata + create CTA. */}
      <aside className="w-full shrink-0 border-gray-100 px-6 py-8 lg:w-[340px] lg:overflow-y-auto lg:border-l">
        <Link
          to="/templates"
          className="inline-flex items-center gap-1.5 text-base font-[420] text-gray-600 hover:text-gray-950"
        >
          <ArrowLeftIcon className="size-4" />
          All templates
        </Link>

        <h1 className="mt-5 text-xl leading-[1.2] font-semibold text-gray-950">{template.label}</h1>
        <p className="mt-2 text-base font-[420] tracking-[0.28px] text-gray-700">
          {template.description}
        </p>

        <dl className="mt-5 space-y-3 text-base">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500">Category</dt>
            <dd className="font-[450] text-gray-800">
              {FORM_TEMPLATE_CATEGORY_LABEL[template.category]}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-gray-500">Created by</dt>
            <dd className="font-[450] text-gray-800">{template.creator}</dd>
          </div>
        </dl>

        {template.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-2 py-0.5 text-[12px] font-[450] text-gray-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <Button
          type="button"
          className="mt-6 w-full"
          disabled={isCreating || !hasWorkspace}
          onClick={() => createFromTemplate(template.id as FormTemplateId)}
        >
          {isCreating ? "Creating…" : "Use this template"}
        </Button>
      </aside>
    </div>
  );
};

export const Route = createFileRoute("/_authenticated/templates/$templateId")({
  loader: ({ params }) => {
    if (!findTemplateMeta(params.templateId)) throw notFound();
  },
  component: TemplatePreviewPage,
  notFoundComponent: NotFound,
});
