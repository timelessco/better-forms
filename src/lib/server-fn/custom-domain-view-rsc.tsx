import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import * as v from "valibot";

// Thin stubs: dynamically import ./custom-domain-view-rsc.impl so platejs/BaseEditorKit/EditorStatic
// never reach the client bundle. Mirrors public-form-view-rsc.tsx on the app-domain route.

export const getCustomDomainFormByIdRSC = createServerFn({ method: "GET" })
  .validator(v.object({ formId: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data }) => {
    const host = getRequestHost({ xForwardedHost: true });
    const { runCustomDomainByIdRSC } = await import("./custom-domain-view-rsc.impl");
    return runCustomDomainByIdRSC(data, host);
  });

export const getCustomDomainFormBySlugRSC = createServerFn({ method: "GET" })
  .validator(v.object({ slug: v.string() }))
  .handler(async ({ data }) => {
    const host = getRequestHost({ xForwardedHost: true });
    const { runCustomDomainBySlugRSC } = await import("./custom-domain-view-rsc.impl");
    return runCustomDomainBySlugRSC(data, host);
  });
