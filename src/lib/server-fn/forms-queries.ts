import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { _getFormById, getArchivedFormListings } from "./forms";

// Client-safe query helpers split out of forms.ts: importing these must NOT pull
// forms.ts's top-level @/db/schema import into the client bundle. They reference
// server fns (proxied on the client), so this module stays free of drizzle/schema.

export const archivedFormListingsQueryOptions = () =>
  queryOptions({
    queryKey: ["form-listings-archived"],
    queryFn: ({ signal }) => getArchivedFormListings({ signal }),
    staleTime: 1000 * 60, // 1 min — refetched on dialog reopen anyway
  });

/** Real `_getFormById` return: `{ form: serializeForm(row) }` (dates as ISO strings). */
export type FormByIdResult = Awaited<ReturnType<typeof _getFormById>>;

export const getFormbyIdQueryOption = (formId: string) =>
  queryOptions({
    queryKey: ["forms", formId],
    queryFn: ({ signal }): Promise<FormByIdResult> =>
      _getFormById({ data: { id: formId }, signal }),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

export type FormStatus = "draft" | "published" | "archived";

const FORM_STATUS_VALUES = ["draft", "published", "archived"] as const;

const isFormStatus = (status: string): status is FormStatus =>
  FORM_STATUS_VALUES.some((value) => value === status);

// status is `text` at the DB → typed `string`; narrow to the known union (unknown values → undefined).
const toFormStatus = (status: string | undefined): FormStatus | undefined =>
  status !== undefined && isFormStatus(status) ? status : undefined;

export const getFormStatus = async (
  queryClient: QueryClient,
  formId: string,
): Promise<FormStatus | undefined> => {
  const result = await queryClient.ensureQueryData({
    ...getFormbyIdQueryOption(formId),
    revalidateIfStale: true,
  });

  return toFormStatus(result.form?.status);
};
