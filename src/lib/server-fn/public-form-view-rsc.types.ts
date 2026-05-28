import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";

/** Pure-type RSC slot contracts. In a .types.ts so the client can import without pulling the
 * server fn module (which imports drizzle/pg). */

export type FieldSlotProps = {
  fieldId: string;
  field: PlateFormField;
};

type ButtonGroupButton = {
  id: string;
  name: string;
  fieldType: "Button";
  buttonText?: string;
  buttonRole: "next" | "previous" | "submit";
};

export type ButtonGroupSlotProps = {
  groupId: string;
  buttons: ButtonGroupButton[];
};
