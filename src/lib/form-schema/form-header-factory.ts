export interface FormHeaderElementData {
  type: "formHeader";
  id?: string;
  title: string;
  icon: string | null;
  iconColor: string | null;
  cover: string | null;
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
  children: [{ text: "" }],
});
