import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { forms } from "@/db/schema";
import { db } from "@/db";
import { FORM_ID_RE, publicCorsHeaders } from "@/lib/config/embed-cors";
import { formCacheHeaders } from "@/lib/server-fn/cdn-cache";

const SHORT_CACHE_CONTROL = "public, max-age=60";

export const Route = createFileRoute("/api/forms/$shortId/meta")({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: { ...publicCorsHeaders, "Cache-Control": SHORT_CACHE_CONTROL },
        }),
      GET: async ({ params }: { params: { formId: string } }) => {
        if (!FORM_ID_RE.test(params.formId)) {
          return new Response(JSON.stringify({ error: "invalid_form_id" }), {
            status: 400,
            headers: {
              ...publicCorsHeaders,
              "Cache-Control": SHORT_CACHE_CONTROL,
              "Content-Type": "application/json",
            },
          });
        }

        const [form] = await db
          .select({
            id: forms.id,
            title: forms.title,
            icon: forms.icon,
            cover: forms.cover,
          })
          .from(forms)
          .where(and(eq(forms.id, params.formId), eq(forms.status, "published")));

        // Tag both the 200 and 404 responses so a `purgeFormCache(formId)` on
        // publish/edit/delete also invalidates a cached "not found".
        const cache = formCacheHeaders(params.formId, { gated: false });
        const headers = {
          ...publicCorsHeaders,
          ...cache,
          "Content-Type": "application/json",
        };

        if (!form) {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers,
          });
        }

        return new Response(JSON.stringify(form), { status: 200, headers });
      },
    },
  },
});
