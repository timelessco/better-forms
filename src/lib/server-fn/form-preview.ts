import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { forms } from "@/db/schema";
import { db } from "@/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { putBlob } from "@/integrations/blob";
import { getActiveOrgId } from "./auth-helpers";
import { authForm } from "./auth-helpers.server";

// Strip an optional data-URL prefix, leaving raw base64.
const stripDataUrl = (s: string) => s.replace(/^data:image\/png;base64,/, "");

/**
 * Persists a generated content thumbnail (client-rendered Plate → PNG) to Blob and stores its URL on
 * the form. Called best-effort after publish; the URL feeds both the dashboard card and OG image.
 * Keyed by formId + contentHash (+ timestamp) so each publish gets a fresh, cache-bustable URL.
 */
export const uploadFormPreview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    v.object({
      formId: v.pipe(v.string(), v.uuid()),
      contentHash: v.pipe(v.string(), v.minLength(1)),
      pngBase64: v.pipe(v.string(), v.minLength(1)),
    }),
  )
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authForm(data.formId, context.session.user.id, orgId);

    const body = Buffer.from(stripDataUrl(data.pngBase64), "base64");
    const key = `forms/${data.formId}/preview-${data.contentHash}-${Date.now()}.png`;
    const { url } = await putBlob(key, body, "image/png");

    await db.update(forms).set({ previewImageUrl: url }).where(eq(forms.id, data.formId));
    return { url };
  });
