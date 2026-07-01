/** Default cover focal point (object-position-y %); 62% matches the Figma cover framing.
 * Shared by editor, Preview, public so an un-repositioned cover frames identically everywhere. */
export const DEFAULT_COVER_POSITION = 62;

export interface FormHeaderElementData {
  type: "formHeader";
  id?: string;
  title: string;
  icon: string | null;
  iconColor: string | null;
  cover: string | null;
  /** Vertical focal point of the cover as object-position-y %, 0 (top) – 100 (bottom). */
  coverPosition?: number;
  children: [{ text: "" }];
}

export const createFormHeaderNode = (
  data: Partial<Omit<FormHeaderElementData, "type" | "children">> = {},
): FormHeaderElementData => ({
  type: "formHeader",
  title: data.title ?? "",
  icon: data.icon ?? null,
  iconColor: data.iconColor ?? null,
  cover: data.cover ?? null,
  coverPosition: data.coverPosition,
  children: [{ text: "" }],
});
