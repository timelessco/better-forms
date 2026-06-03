import type { QueryClient } from "@tanstack/query-core";
import { createFavoriteCollection, createFormListingCollection } from "./query/form-listing";
import { createWorkspaceSummaryCollection } from "./query/workspace";
import type { createForm, updateForm } from "@/lib/server-fn/forms";
import { state, stripNulls } from "./_state";
import type { ServerFnInput, ServerFns } from "./_state";

// Trailing-edge debounce: coalesce ~60/sec color-picker drag updates into one updateForm per burst. Other fields persist immediately.
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
      // Single refetch per burst, replacing the per-handler ones suppressed via `{ refetch: false }`.
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
      // Forward sortIndex so server writes row + per-user sort entry in one txn, keeping new workspace on top after refetch.
      await serverFns.createWorkspace({
        id: ws.id,
        organizationId: ws.organizationId,
        name: ws.name,
        sortIndex: ws.sortIndex ?? undefined,
      });
    },
    onUpdate: async ({ transaction }) => {
      const m = transaction.mutations[0];
      const { changes } = m;
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
        // `name` is the only field updateWorkspace accepts (and the only non-sortIndex field this collection mutates).
        pending.push(serverFns.updateWorkspace({ id: m.original.id, name: rest.name }));
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
      const { changes } = m;

      // No-op guard: `updatedAt`-only diff means structural diff found no real change (e.g. debouncedSave rewriting same content). Skip the roundtrip.
      const realKeys = Object.keys(changes).filter((k) => k !== "updatedAt");
      if (realKeys.length === 0) return { refetch: false };
      const isCustomizationOnly = realKeys.length === 1 && realKeys[0] === "customization";

      const data = stripNulls({
        id: m.original.id,
        ...changes,
      }) as ServerFnInput<typeof updateForm>;

      // Coalesce customization-only changes (pickers/scrubbers): handler Promise resolves only when the debounced call lands, so optimistic state holds (no flash-back).
      // Skip per-handler refetch (`{ refetch: false }`) — would fire N concurrent refetches during a drag; bucket refetches once after the call lands.
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
      const { changes } = m;
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
