import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { forms } from "@/db/schema";
import { db } from "@/db";
import { publicCorsHeaders } from "@/lib/config/embed-cors";
import { formCacheHeaders } from "@/lib/server-fn/cdn-cache";
import { isValidShortId } from "@/lib/short-id";

const SHORT_CACHE_CONTROL = "public, max-age=60";

export const Route = createFileRoute("/api/forms/$shortId/meta")({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: { ...publicCorsHeaders, "Cache-Control": SHORT_CACHE_CONTROL },
        }),
      GET: async ({ params }: { params: { shortId: string } }) => {
        if (!isValidShortId(params.shortId)) {
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
          .where(and(eq(forms.shortId, params.shortId), eq(forms.status, "published")));

        if (!form) {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: {
              ...publicCorsHeaders,
              "Cache-Control": SHORT_CACHE_CONTROL,
              "Content-Type": "application/json",
            },
          });
        }

        // Tag the 200 with the form's UUID so `purgeFormCache(formId)` on
        // publish/edit/delete reaches this cached entry. Public surfaces use
        // shortId; cache tagging stays on the UUID for purge symmetry.
        const cache = formCacheHeaders(form.id, { gated: false });
        return new Response(JSON.stringify(form), {
          status: 200,
          headers: {
            ...publicCorsHeaders,
            ...cache,
            "Content-Type": "application/json",
          },
        });
      },
    },
  },
});
