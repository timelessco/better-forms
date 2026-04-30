/**
 * Local-only form collection (localStorage-backed) for unauthenticated drafts.
 * This is localStorage-backed and independent of the query-based collections.
 */
import { createCollection, localStorageCollectionOptions } from "@tanstack/react-db";
import { z } from "zod";
import { createFormHeaderNode } from "@/lib/form-schema/form-header-factory";
import { defaultFormSettings } from "@/types/form-settings";
import type { FormSettings } from "@/types/form-settings";

/** Parse Postgres timestamp (no TZ) as UTC before converting to ISO. */
const parseAsUTC = (val: string): string => {
  if (val.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(val)) return new Date(val).toISOString();
  return new Date(val.replace(" ", "T") + "Z").toISOString();
};

const timestampField = z
  .string()
  .optional()
  .transform((val) => (val ? parseAsUTC(val) : new Date().toISOString()));

export const FormSchema = z.object({
  id: z.uuid(),
  createdByUserId: z.string().optional(),
  workspaceId: z.uuid(),
  title: z.string().default("Untitled"),
  formName: z.string().default("draft"),
  schemaName: z.string().default("draftFormSchema"),
  content: z.array(z.any()).default([]),
  icon: z.string().nullable().optional(),
  cover: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  lastPublishedVersionId: z.string().nullable().optional(),
  publishedContentHash: z.string().nullable().optional(),
  settings: z.custom<FormSettings>().default(() => defaultFormSettings),
  customization: z.record(z.string(), z.any()).default({}),
  createdAt: timestampField,
  updatedAt: timestampField,
});

export type Form = z.infer<typeof FormSchema>;

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
