import { sql } from "drizzle-orm";
import { forms } from "@/db/schema";
import type { FormSettings } from "@/types/form-settings";

// Server-only: references the `forms` table value + drizzle `sql`. Kept out of forms.ts
// (a client-reachable server-fn module) so its module-level schema reference doesn't pin
// drizzle-orm into the client bundle. The `.server.ts` suffix strips it from the client.

/** Shallow-merge settings patch into forms.draftSettings JSONB (working draft only;
 * live settings served to public renderers live in form_settings). */
export const mergeFormSettings = (patch: Partial<FormSettings>) =>
  sql`${forms.draftSettings} || ${JSON.stringify(patch)}::jsonb`;
