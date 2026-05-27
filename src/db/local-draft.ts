/** Local draft form utilities — dynamic UUIDs to avoid ID collisions during sync. */

const LOCAL_FORM_ID_KEY = "local-draft-form-id";
const LOCAL_WORKSPACE_ID_KEY = "local-draft-workspace-id";

/** Get/create a per-session local form ID — unique per user, prevents sync collisions. */
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

/** Clear local draft IDs after successful sync, so fresh drafts can start. */
export const clearLocalDraftIds = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_FORM_ID_KEY);
  localStorage.removeItem(LOCAL_WORKSPACE_ID_KEY);
};
