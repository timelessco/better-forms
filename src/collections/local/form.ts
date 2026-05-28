/** Local-only form collection (localStorage-backed) for unauthenticated drafts; independent of the query-based collections. */
import { createCollection, localStorageCollectionOptions } from "@tanstack/react-db";
import * as v from "valibot";
import { createFormHeaderNode } from "@/lib/form-schema/form-header-factory";
import { defaultFormSettings } from "@/types/form-settings";
import type { FormSettings } from "@/types/form-settings";

/** Parse Postgres timestamp (no TZ) as UTC before converting to ISO. */
const parseAsUTC = (val: string): string => {
  if (val.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(val)) return new Date(val).toISOString();
  return new Date(val.replace(" ", "T") + "Z").toISOString();
};

const timestampField = v.pipe(
  v.optional(v.string()),
  v.transform((val) => (val ? parseAsUTC(val) : new Date().toISOString())),
);

export const FormSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  createdByUserId: v.optional(v.string()),
  workspaceId: v.pipe(v.string(), v.uuid()),
  title: v.optional(v.string(), "Untitled"),
  formName: v.optional(v.string(), "draft"),
  schemaName: v.optional(v.string(), "draftFormSchema"),
  content: v.optional(v.array(v.any()), []),
  icon: v.nullish(v.string()),
  cover: v.nullish(v.string()),
  status: v.optional(v.picklist(["draft", "published", "archived"]), "draft"),
  lastPublishedVersionId: v.nullish(v.string()),
  publishedContentHash: v.nullish(v.string()),
  draftSettings: v.optional(
    v.custom<FormSettings>(() => true),
    () => defaultFormSettings,
  ),
  // Live settings — no server row for local drafts; mirrors draft until sign-in + publish.
  liveSettings: v.optional(
    v.custom<FormSettings | null>(() => true),
    () => null,
  ),
  customization: v.optional(v.record(v.string(), v.any()), {}),
  createdAt: timestampField,
  updatedAt: timestampField,
});

export type Form = v.InferOutput<typeof FormSchema>;

export const localFormCollection = createCollection(
  localStorageCollectionOptions({
    id: "draft-form",
    storageKey: "draft-form",
    schema: FormSchema,
    getKey: (item) => item.id,
  }),
);

export const DEFAULT_FORM_CONTENT = [
  createFormHeaderNode({ title: "Untitled", icon: null, cover: null }),
  {
    children: [{ text: "Start building your form..." }],
    type: "p",
  },
];
