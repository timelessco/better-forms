import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { shortIdSchema } from "@/lib/short-id";

// IMPORTANT: This file is imported by `$shortId.tsx` on the client. Keep
// top-level imports free of platejs/BaseEditorKit/EditorStatic — those drag
// the `editor` chunk (361 kB + KaTeX CSS) into the main client entry via
// Rollup's module graph. All heavy work lives behind a dynamic import in the
// handler body, which Start strips from the client build.
export const getPublicFormViewRSC = createServerFn({ method: "GET" })
  .inputValidator(z.object({ shortId: shortIdSchema }))
  .handler(async ({ data }) => {
    const { runPublicFormViewRSC } = await import("./public-form-view-rsc.impl");
    return runPublicFormViewRSC(data);
  });
