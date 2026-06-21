import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { createFormListingCollection } from "@/collections/query/form-listing";
import type { FormListing } from "@/collections/query/form-listing";
import { createFormLocal } from "@/collections/operations";
import { state } from "@/collections/_state";
import type { ServerFns } from "@/collections/_state";

// `getInit()` reads from the mutable module-level `state` singleton (src/collections/_state.ts),
// so we can inject fakes by assigning to `state` directly — no DI seam added to production code.

const WORKSPACE_ID = "ws-test";

/** Snapshot/restore the bits of `state` we touch so tests stay isolated. */
const stateBackup = {
  serverFns: state.serverFns,
  queryClient: state.queryClient,
  formListings: state.formListings,
};

afterEach(() => {
  state.serverFns = stateBackup.serverFns;
  state.queryClient = stateBackup.queryClient;
  state.formListings = stateBackup.formListings;
  vi.restoreAllMocks();
});

/**
 * Wire up an in-memory form-listing collection (real TanStack DB collection over a
 * controllable backing array) plus a stubbed `serverFns`, then assign them onto `state`.
 */
const wireState = async (opts: { backing: FormListing[]; createForm: ServerFns["createForm"] }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const formListings = createFormListingCollection({
    queryClient,
    queryFn: async () => [...opts.backing],
  });
  await formListings.stateWhenReady();

  state.queryClient = queryClient;
  state.formListings = formListings;
  // Only `createForm` is exercised by createFormLocal; cast the partial stub.
  state.serverFns = { createForm: opts.createForm } as unknown as ServerFns;

  return { queryClient, formListings };
};

describe("createFormLocal", () => {
  it("optimistically inserts a listing derived from the new form", async () => {
    const backing: FormListing[] = [];
    const createForm = vi.fn(async () => undefined) as unknown as ServerFns["createForm"];
    const { formListings } = await wireState({ backing, createForm });

    const { form } = createFormLocal(WORKSPACE_ID, "My Title");

    // Optimistic row is visible synchronously after mutate().
    const listing = formListings.get(form.id);
    expect(listing).toBeDefined();
    expect(listing).toMatchObject({
      id: form.id,
      title: "My Title",
      workspaceId: WORKSPACE_ID,
      status: "draft",
      shortId: "",
      submissionCount: 0,
    });
    expect(form.workspaceId).toBe(WORKSPACE_ID);
    expect(form.title).toBe("My Title");
  });

  it("accepts an options object with title + content", async () => {
    const backing: FormListing[] = [];
    const createForm = vi.fn(async () => undefined) as unknown as ServerFns["createForm"];
    await wireState({ backing, createForm });

    const content = [{ type: "p", children: [{ text: "hi" }] }];
    const { form } = createFormLocal(WORKSPACE_ID, { title: "Configured", content });

    expect(form.title).toBe("Configured");
    expect(form.content).toBe(content);
  });

  it("resolves `persisted` once the server fn succeeds", async () => {
    const backing: FormListing[] = [];
    // On success, server "writes" the form so a refetch keeps the row.
    const createForm = vi.fn(async (data: { data?: { id?: string } } | unknown) => {
      const id = (data as { id?: string }).id;
      if (id) backing.push({ id } as FormListing);
      return undefined;
    }) as unknown as ServerFns["createForm"];
    const { formListings } = await wireState({ backing, createForm });

    const { form, persisted } = createFormLocal(WORKSPACE_ID, "Persisted");

    await expect(persisted).resolves.toBeUndefined();
    expect(createForm).toHaveBeenCalledTimes(1);
    expect(formListings.get(form.id)).toBeDefined();
  });

  it("rolls back the optimistic row when the server fn rejects", async () => {
    const backing: FormListing[] = []; // server never has the form
    const createForm = vi.fn(async () => {
      throw new Error("server boom");
    }) as unknown as ServerFns["createForm"];
    const { formListings } = await wireState({ backing, createForm });

    const { form, persisted } = createFormLocal(WORKSPACE_ID, "Doomed");

    // Optimistically present immediately.
    expect(formListings.get(form.id)).toBeDefined();

    // The transaction rejects; swallow it so the test can assert on rollback.
    await expect(persisted).rejects.toBeDefined();

    // After rollback + refetch (server has no such row), the optimistic row is gone.
    await vi.waitFor(() => {
      expect(formListings.get(form.id)).toBeUndefined();
    });
  });
});
