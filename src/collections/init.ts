import type { QueryClient } from "@tanstack/query-core";
import { createFavoriteCollection, createFormListingCollection } from "./query/form-listing";
import { createWorkspaceSummaryCollection } from "./query/workspace";
import type { createForm, updateForm } from "@/lib/server-fn/forms";
import { state, stripNulls } from "./_state";
import type { ServerFnInput, ServerFns } from "./_state";

// Trailing-edge debounce window for customization-only updates. Color picker
// drags fire `collection.update` ~60 times/sec; we coalesce them into one
// `updateForm` call per drag burst (250ms after the last change). Other
// fields (title, content, status) bypass and persist immediately.
const FORM_CUSTOMIZATION_DEBOUNCE_MS = 250;

type PendingCustomizationUpdate = {
  data: ServerFnInput<typeof updateForm>;
  resolves: Array<() => void>;
  rejects: Array<(err: unknown) => void>;
  timer: ReturnType<typeof setTimeout>;
};

export const initCollections = (queryClient: QueryClient, serverFns: ServerFns) => {
  state.queryClient = queryClient;
  state.serverFns = serverFns;

  // Per-form bucket so concurrent edits across forms don't collide.
  const pendingCustomizationUpdates = new Map<string, PendingCustomizationUpdate>();

  const flushCustomizationUpdate = async (formId: string) => {
    const bucket = pendingCustomizationUpdates.get(formId);
    if (!bucket) return;
    pendingCustomizationUpdates.delete(formId);
    try {
      await serverFns.updateForm(bucket.data);
      // Single refetch for the whole drag burst, replacing the per-handler
      // auto-refetches we suppressed with `{ refetch: false }`.
      await state.formListings?.utils.refetch();
      for (const r of bucket.resolves) r();
    } catch (err) {
      for (const reject of bucket.rejects) reject(err);
    }
  };

  state.workspaces = createWorkspaceSummaryCollection({
    queryClient,
    queryFn: serverFns.getWorkspacesWithForms,
    onInsert: async ({ transaction }) => {
      const ws = transaction.mutations[0].modified;
      await serverFns.createWorkspace({
        id: ws.id,
        organizationId: ws.organizationId,
        name: ws.name,
      });
    },
    onUpdate: async ({ transaction }) => {
      const m = transaction.mutations[0];
      const changes = m.changes as Record<string, unknown>;
      // sortIndex is per-user, routed to dedicated endpoint; other fields go to updateWorkspace
      const { sortIndex, ...rest } = changes;
      const pending: Promise<unknown>[] = [];
      if (typeof sortIndex === "string") {
        pending.push(
          serverFns.reorderWorkspace({
            workspaceId: m.original.id,
            sortIndex,
          }),
        );
      }
      if (Object.keys(rest).length > 0) {
        pending.push(serverFns.updateWorkspace({ id: m.original.id, ...rest }));
      }
      await Promise.all(pending);
    },
    onDelete: async ({ transaction }) => {
      await serverFns.deleteWorkspace({ id: transaction.mutations[0].original.id });
    },
  });

  state.formListings = createFormListingCollection({
    queryClient,
    queryFn: serverFns.getFormListings,
    onInsert: async ({ transaction }) => {
      const modified = transaction.mutations[0].modified;
      await serverFns.createForm(stripNulls(modified) as ServerFnInput<typeof createForm>);
    },
    onUpdate: async ({ transaction }) => {
      const m = transaction.mutations[0];
      const changes = m.changes as Record<string, unknown>;

      // No-op guard: if the only diff is `updatedAt`, the caller intended to
      // change a field but TanStack DB's structural diff found the new value
      // equal to the original (e.g. editor's `debouncedSave` writing back the
      // same content). Don't burn a server roundtrip on a pure timestamp bump.
      const realKeys = Object.keys(changes).filter((k) => k !== "updatedAt");
      if (realKeys.length === 0) return { refetch: false };
      const isCustomizationOnly = realKeys.length === 1 && realKeys[0] === "customization";

      const data = stripNulls({
        id: m.original.id,
        ...changes,
      }) as ServerFnInput<typeof updateForm>;

      // Customization-only changes (color pickers, scrubbers) are coalesced.
      // The handler returns a Promise that resolves only once the debounced
      // server call lands — TanStack DB holds optimistic state until then,
      // so the UI stays smooth without flashing back to the synced snapshot.
      // Skip the per-handler auto-refetch (`{ refetch: false }`): during a
      // drag we'd otherwise fire N concurrent `getFormListings` refetches
      // (one per pending mutation). The bucket itself triggers a single
      // refetch after the server call lands.
      if (!isCustomizationOnly) {
        await serverFns.updateForm(data);
        return;
      }

      const formId = m.original.id;
      await new Promise<void>((resolve, reject) => {
        const existing = pendingCustomizationUpdates.get(formId);
        if (existing) {
          clearTimeout(existing.timer);
          existing.data = data;
          existing.resolves.push(resolve);
          existing.rejects.push(reject);
          existing.timer = setTimeout(
            () => flushCustomizationUpdate(formId),
            FORM_CUSTOMIZATION_DEBOUNCE_MS,
          );
        } else {
          pendingCustomizationUpdates.set(formId, {
            data,
            resolves: [resolve],
            rejects: [reject],
            timer: setTimeout(
              () => flushCustomizationUpdate(formId),
              FORM_CUSTOMIZATION_DEBOUNCE_MS,
            ),
          });
        }
      });
      return { refetch: false };
    },
    onDelete: async ({ transaction }) => {
      await serverFns.deleteForm({ id: transaction.mutations[0].original.id });
    },
  });

  state.favorites = createFavoriteCollection({
    queryClient,
    queryFn: serverFns.getFavorites,
    onInsert: async ({ transaction }) => {
      const modified = transaction.mutations[0].modified;
      await serverFns.addFavorite({
        formId: modified.formId,
        sortIndex: modified.sortIndex ?? undefined,
      });
    },
    onUpdate: async ({ transaction }) => {
      const m = transaction.mutations[0];
      const changes = m.changes as Record<string, unknown>;
      if (typeof changes.sortIndex === "string") {
        await serverFns.reorderFavorite({
          formId: m.original.formId,
          sortIndex: changes.sortIndex,
        });
      }
    },
    onDelete: async ({ transaction }) => {
      await serverFns.removeFavorite({ formId: transaction.mutations[0].original.formId });
    },
  });
};
