// Bridges the Plate editor's header cover/logo setter to the Customize sidebar, which mounts
// above the editor's EditorThemeProvider (route layout) so React context can't reach it. The
// editable editor registers its live `setNodes` setter by formId; the sidebar looks it up at
// click time. Only the editable (non-readOnly) editor should register.
type HeaderMediaField = "icon" | "cover" | "iconColor";
type HeaderMediaSetter = (field: HeaderMediaField, value: string | null) => void;

const setters = new Map<string, HeaderMediaSetter>();

/** Register the setter for a form; returns a cleanup that removes it (only if still current). */
export const registerHeaderMediaSetter = (formId: string, setter: HeaderMediaSetter) => {
  setters.set(formId, setter);
  return () => {
    if (setters.get(formId) === setter) setters.delete(formId);
  };
};

export const getHeaderMediaSetter = (formId: string): HeaderMediaSetter | undefined =>
  setters.get(formId);
