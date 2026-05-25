import { eq, useLiveQuery } from "@tanstack/react-db";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import {
  isInitialized,
  getWorkspaces,
  getFormListings,
  getFavorites,
  enrichFormDetail,
} from "@/collections";
import { localFormCollection } from "@/collections/local/form";
import { archivedFormListingsQueryOptions } from "@/lib/server-fn/forms";

export const useOrgWorkspaces = (organizationId?: string) =>
  useLiveQuery(
    (q) => {
      if (!organizationId || !isInitialized()) return undefined;
      return q
        .from({ ws: getWorkspaces() })
        .where(({ ws }) => eq(ws.organizationId, organizationId))
        .select(({ ws }) => ({
          id: ws.id,
          organizationId: ws.organizationId,
          createdByUserId: ws.createdByUserId,
          name: ws.name,
          createdAt: ws.createdAt,
          updatedAt: ws.updatedAt,
          sortIndex: ws.sortIndex,
        }));
    },
    [organizationId],
  );

export const useWorkspace = (workspaceId?: string) => {
  const result = useLiveQuery(
    (q) => {
      if (!workspaceId || !isInitialized()) return undefined;
      const query = q.from({ ws: getWorkspaces() }).where(({ ws }) => eq(ws.id, workspaceId));
      return query.select(({ ws }) => ({
        id: ws.id,
        organizationId: ws.organizationId,
        createdByUserId: ws.createdByUserId,
        name: ws.name,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      }));
    },
    [workspaceId],
  );
  return { ...result, data: result.data?.[0] };
};

/**
 * The query-backed formListings collection already filters by org membership server-side.
 */
export const useOrgForms = (_organizationId?: string) =>
  useLiveQuery((q) => {
    if (!isInitialized()) return undefined;
    return q
      .from({ form: getFormListings() })
      .select(({ form }) => ({
        id: form.id,
        title: form.title,
        workspaceId: form.workspaceId,
        status: form.status,
        updatedAt: form.updatedAt,
        icon: form.icon,
        customization: form.customization,
        sortIndex: form.sortIndex,
      }))
      .orderBy(({ form }) => form.updatedAt, "desc");
  }, []);

/**
 * Queries the unified formListings collection and enriches with full
 * detail (content, settings, etc.) on demand via a TanStack Query.
 */
export const useForm = (formId?: string) => {
  const result = useLiveQuery(
    (q) => {
      if (!formId || !isInitialized()) return undefined;
      return q.from({ form: getFormListings() }).where(({ form }) => eq(form.id, formId));
    },
    [formId],
  );

  const needsEnrichment = !!formId && isInitialized() && result.data?.[0]?.content === undefined;
  useQuery({
    queryKey: ["form-enrich", formId],
    queryFn: () => enrichFormDetail(formId as string),
    enabled: needsEnrichment,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return result;
};

export const useLocalForm = (formId?: string) =>
  useLiveQuery(
    (q) => {
      if (!formId) return undefined;
      return q.from({ doc: localFormCollection }).where(({ doc }) => eq(doc.id, formId));
    },
    [formId],
  );

export const useFavorites = (userId?: string) =>
  useLiveQuery(
    (q) => {
      if (!userId || !isInitialized()) return undefined;
      return q
        .from({ fav: getFavorites() })
        .where(({ fav }) => eq(fav.userId, userId))
        .select(({ fav }) => ({
          id: fav.id,
          userId: fav.userId,
          formId: fav.formId,
          sortIndex: fav.sortIndex,
          createdAt: fav.createdAt,
        }));
    },
    [userId],
  );

export const useIsFavorite = (userId?: string, formId?: string) => {
  const { data } = useLiveQuery(
    (q) => {
      if (!userId || !formId || !isInitialized()) return undefined;
      return q
        .from({ fav: getFavorites() })
        .where(({ fav }) => eq(fav.userId, userId))
        .where(({ fav }) => eq(fav.formId, formId))
        .select(({ fav }) => ({ id: fav.id }));
    },
    [userId, formId],
  );
  return data !== undefined && data.length > 0;
};

/**
 * Fetches favorites and form listings separately and combines them.
 */
export const useFavoriteForms = (userId?: string) => {
  const { data: favs } = useFavorites(userId);
  const { data: allForms } = useLiveQuery((q) => {
    if (!isInitialized()) return undefined;
    return q.from({ form: getFormListings() }).select(({ form }) => ({
      id: form.id,
      title: form.title,
      workspaceId: form.workspaceId,
      status: form.status,
      updatedAt: form.updatedAt,
      icon: form.icon,
      customization: form.customization,
    }));
  }, []);

  return useMemo(() => {
    if (!favs || !allForms) return [];
    const favByFormId = new Map(favs.map((f) => [f.formId, f]));
    return allForms.flatMap((f) => {
      const fav = favByFormId.get(f.id);
      if (!fav) return [];
      return [
        {
          ...f,
          favoriteId: fav.id,
          favoriteSortIndex: fav.sortIndex ?? null,
          favoriteCreatedAt: fav.createdAt,
        },
      ];
    });
  }, [favs, allForms]);
};

// Archived listings come from a server fn rather than the formListings
// collection — `getFormListings` no longer returns archived rows, so the
// trash dialog fetches its own list on demand. `enabled` keeps the request
// off the wire until the dialog actually opens.
export const useArchivedForms = (enabled = true) =>
  useQuery({ ...archivedFormListingsQueryOptions(), enabled });

export const useSubmissionCounts = () => {
  const { data: allForms } = useLiveQuery((q) => {
    if (!isInitialized()) return undefined;
    return q.from({ form: getFormListings() }).select(({ form }) => ({
      id: form.id,
      submissionCount: form.submissionCount,
    }));
  }, []);

  // TanStack DB live queries hand back fresh array references on every notification,
  // so the upstream useMemo would emit a brand-new Map identity even when no count
  // actually changed. Returning the previous Map reference when contents are
  // identical lets memoised consumers downstream skip re-rendering entirely.
  const previousMapRef = useRef<Map<string, number>>(new Map());

  return useMemo(() => {
    const next = new Map<string, number>();
    if (allForms) {
      for (const form of allForms) {
        if (form.submissionCount > 0) {
          next.set(form.id, form.submissionCount);
        }
      }
    }
    const previous = previousMapRef.current;
    if (previous.size === next.size) {
      let identical = true;
      for (const [id, count] of next) {
        if (previous.get(id) !== count) {
          identical = false;
          break;
        }
      }
      if (identical) return previous;
    }
    previousMapRef.current = next;
    return next;
  }, [allForms]);
};
