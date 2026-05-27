import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";

// Thin stubs: dynamically import ./custom-domain-view-rsc.impl so platejs/BaseEditorKit/EditorStatic
// never reach the client bundle. Mirrors public-form-view-rsc.tsx on the app-domain route.

export const getCustomDomainFormByIdRSC = createServerFn({ method: "GET" })
  .inputValidator(z.object({ formId: z.uuid() }))
  .handler(async ({ data }) => {
    const host = getRequestHost({ xForwardedHost: true });
    const { runCustomDomainByIdRSC } = await import("./custom-domain-view-rsc.impl");
    return runCustomDomainByIdRSC(data, host);
  });

export const getCustomDomainFormBySlugRSC = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const host = getRequestHost({ xForwardedHost: true });
    const { runCustomDomainBySlugRSC } = await import("./custom-domain-view-rsc.impl");
    return runCustomDomainBySlugRSC(data, host);
  });
