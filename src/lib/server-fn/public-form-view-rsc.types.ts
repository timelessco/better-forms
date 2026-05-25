import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";

/**
 * Pure-type declarations for the public-form-view RSC slot contracts.
 * Lives in a `.types.ts` file so the client can import these without
 * pulling the server fn module (which transitively imports drizzle/pg).
 */

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
