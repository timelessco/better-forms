import { createTransaction } from "@tanstack/react-db";
import { logger } from "@/lib/utils";
import { localFormCollection } from "@/collections/local/form";
import { getFormListings, getWorkspaces, createWorkspaceLocal } from "@/collections";
import type { FormListing } from "@/collections";
import { createForm } from "@/lib/server-fn/forms";

type SyncResult = {
  success: boolean;
  syncedForms: string[];
};

/**
 * Client-side function that syncs local forms to the cloud using createTransaction.
 *
 * For each local form, creates a transaction that:
 * - mutationFn: calls createForm() (creates form with all settings in a single row),
 *   then invalidates queries for sync.
 * - tx.mutate(): optimistically inserts form into formListings, deletes from local collection.
 *
 * @param organizationId - The organization ID to sync forms to
 */
export const syncLocalDataToCloud = async (organizationId: string): Promise<SyncResult | null> => {
  try {
    logger("Starting local data sync to cloud via createTransaction...");
    logger(`Organization ID: ${organizationId}`);

    if (!organizationId) {
      console.error("syncLocalDataToCloud: organizationId is required");
      throw new Error("Organization ID is required for sync");
    }

    const localForms = await localFormCollection.toArrayWhenReady();
    logger(`Found ${localForms.length} local forms to sync`);

    if (localForms.length === 0) {
      logger("No local data to sync");
      return null;
    }

    const existingWorkspaces = Array.from((await getWorkspaces().stateWhenReady()).values());
    const orgWorkspaces = existingWorkspaces.filter((ws) => ws.organizationId === organizationId);

    let targetWorkspaceId: string;
    if (orgWorkspaces.length === 0) {
      logger("No workspace found, creating via collection...");
      try {
        const newWorkspace = await createWorkspaceLocal(organizationId, "My workspace");
        targetWorkspaceId = newWorkspace.id;
        logger(`Created workspace ${targetWorkspaceId} via collection`);
      } catch (wsError) {
        console.error("Failed to create workspace:", wsError);
        throw wsError;
      }
    } else {
      targetWorkspaceId = orgWorkspaces[0].id;
      logger(`Using existing workspace ${targetWorkspaceId}`);
    }

    const syncedForms: string[] = [];
    for (const localForm of localForms) {
      try {
        const newFormId = crypto.randomUUID();
        const now = new Date().toISOString();

        const newFormData = {
          id: newFormId,
          workspaceId: targetWorkspaceId,
          createdByUserId: "", // Server will use context.session.user.id
          title: localForm.title || "Untitled",
          formName: localForm.formName || "draft",
          schemaName: localForm.schemaName || "draftFormSchema",
          content: localForm.content || [],
          icon: localForm.icon,
          cover: localForm.cover,
          status: localForm.status || "draft",
          settings: localForm.settings,
          customization: localForm.customization,
          createdAt: now,
          updatedAt: now,
        };

        const tx = createTransaction({
          mutationFn: async () => {
            await createForm({
              data: newFormData,
            });
            await getFormListings().utils.refetch();
          },
        });

        tx.mutate(() => {
          getFormListings().insert(newFormData as unknown as FormListing);
          localFormCollection.delete(localForm.id);
        });

        syncedForms.push(newFormId);
        logger(
          `Synced form "${localForm.title || "Untitled"}" as ${newFormId} via createTransaction`,
        );
      } catch (error) {
        console.error(`Failed to sync form "${localForm.title || "Untitled"}":`, error);
      }
    }

    logger(`Successfully synced ${syncedForms.length} forms via createTransaction`);

    // Nuke the localStorage collection entirely so sync never re-runs on reload
    if (syncedForms.length > 0 && typeof window !== "undefined") {
      localStorage.removeItem("draft-form");
    }

    return {
      success: true,
      syncedForms,
    };
  } catch (error) {
    console.error("Failed to sync local data to cloud:", error);
    throw error;
  }
};

export const hasLocalDataToSync = async (): Promise<boolean> => {
  try {
    const forms = await localFormCollection.toArrayWhenReady();
    return forms.length > 0;
  } catch (error) {
    console.error("Failed to check for local data:", error);
    return false;
  }
};
