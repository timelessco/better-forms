import { notFound } from "@tanstack/react-router";
import type { Value } from "platejs";

import { transformPlateForPreview } from "@/lib/editor/transform-plate-for-preview";
import type { PreviewStepResult } from "@/lib/editor/transform-plate-for-preview";
import { applyFormCacheHeaders } from "@/lib/server-fn/cdn-cache";
import { isAppHost } from "@/lib/server-fn/custom-domain-loader";
import {
  loadFormForCustomDomain,
  resolveCustomDomain,
  resolveDomainForSlug,
} from "@/lib/server-fn/custom-domain-loader.server";
import { getFieldChunkUrls } from "@/lib/server-fn/field-chunk-manifest.server";
import {
  renderHeaderComponent,
  renderStepComponent,
  renderThankYouComponent,
} from "@/lib/server-fn/public-form-view-rsc.impl";

// Shared RSC-payload builder: takes the already-loaded form record from
// `loadFormForCustomDomain` and fans out the three render passes (steps,
// thank-you, header) in parallel. Kept in one place so `/f/$formId` and
// `/$slug` don't diverge.
const buildPayload = async (base: Awaited<ReturnType<typeof loadFormForCustomDomain>>) => {
  const { steps, thankYouNodes }: PreviewStepResult = base.form
    ? transformPlateForPreview(base.form.content as Value)
    : { steps: [], thankYouNodes: null };

  const [stepComponents, thankYou, header] = await Promise.all([
    Promise.all(steps.map((segs) => renderStepComponent(segs))),
    renderThankYouComponent(thankYouNodes),
    base.form
      ? renderHeaderComponent({
          title: base.form.title,
          icon: base.form.icon,
          cover: base.form.cover,
          customization: base.form.customization,
        })
      : Promise.resolve(null),
  ]);

  const firstStepFieldTypes = stepComponents[0]
    ? [...new Set(stepComponents[0].fields.map((f) => f.fieldType))]
    : [];
  const preloadModuleUrls = await getFieldChunkUrls(firstStepFieldTypes);

  return {
    ...base,
    steps: stepComponents,
    stepCount: steps.length,
    thankYou,
    header,
    preloadModuleUrls,
  };
};

export const runCustomDomainByIdRSC = async (data: { formId: string }, host: string) => {
  if (isAppHost(host)) {
    // `/f/:id` is reserved for custom domain requests; refuse to serve it
    // from an app host so stray links can't leak custom-domain content.
    throw notFound();
  }

  const domain = await resolveCustomDomain(host);
  const base = await loadFormForCustomDomain(domain, data.formId, "id");

  if (base.form) applyFormCacheHeaders(base.form.id, { gated: !!base.gated });

  return buildPayload(base);
};

export const runCustomDomainBySlugRSC = async (data: { slug: string }, host: string) => {
  const domain = isAppHost(host)
    ? await resolveDomainForSlug(data.slug)
    : await resolveCustomDomain(host);

  const base = await loadFormForCustomDomain(domain, data.slug, "slug");

  if (base.form) applyFormCacheHeaders(base.form.id, { gated: !!base.gated });

  return buildPayload(base);
};
