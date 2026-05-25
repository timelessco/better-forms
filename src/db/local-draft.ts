/**
 * Local draft form utilities
 * Manages dynamic UUIDs for local draft forms to avoid ID collisions during sync
 */

const LOCAL_FORM_ID_KEY = "local-draft-form-id";
const LOCAL_WORKSPACE_ID_KEY = "local-draft-workspace-id";

/**
 * Gets or creates a unique local form ID for this browser session.
 * This ensures each user has a unique form ID, preventing collisions during sync.
 */
export const getLocalFormId = (): string => {
  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }

  let id = localStorage.getItem(LOCAL_FORM_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LOCAL_FORM_ID_KEY, id);
  }
  return id;
};

/**
 * Gets or creates a unique local workspace ID for this browser session.
 */
export const getLocalWorkspaceId = (): string => {
  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }

  let id = localStorage.getItem(LOCAL_WORKSPACE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LOCAL_WORKSPACE_ID_KEY, id);
  }
  return id;
};

/**
 * Clears local draft IDs after successful sync.
 * Should be called after forms are synced to cloud to allow fresh drafts.
 */
export const clearLocalDraftIds = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_FORM_ID_KEY);
  localStorage.removeItem(LOCAL_WORKSPACE_ID_KEY);
};
