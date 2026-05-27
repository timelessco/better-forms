import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { shortIdSchema } from "@/lib/short-id";

// IMPORTANT: imported by $shortId.tsx on the client. Keep top-level imports free of
// platejs/BaseEditorKit/EditorStatic — they drag the editor chunk (361 kB + KaTeX CSS) into the
// client entry. Heavy work lives behind a dynamic import in the handler, which Start strips.
export const getPublicFormViewRSC = createServerFn({ method: "GET" })
  .inputValidator(z.object({ shortId: shortIdSchema }))
  .handler(async ({ data }) => {
    const { runPublicFormViewRSC } = await import("./public-form-view-rsc.impl");
    return runPublicFormViewRSC(data);
  });
