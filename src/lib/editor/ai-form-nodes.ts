import type { TElement } from "platejs";

type FormBlockArgs = {
  fieldType: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

type FormSectionArgs = {
  title: string;
  level?: string | number;
};

const FIELD_TYPE_MAP: Record<string, { nodeType: string; defaultPlaceholder?: string }> = {
  input: { nodeType: "formInput", defaultPlaceholder: "Type Placeholder text" },
  textarea: { nodeType: "formTextarea", defaultPlaceholder: "Type a placeholder" },
  email: { nodeType: "formEmail", defaultPlaceholder: "email@example.com" },
  phone: { nodeType: "formPhone", defaultPlaceholder: "+1 (555) 000-0000" },
  number: { nodeType: "formNumber", defaultPlaceholder: "0" },
  link: { nodeType: "formLink", defaultPlaceholder: "https://example.com" },
  date: { nodeType: "formDate", defaultPlaceholder: "Select a date" },
  time: { nodeType: "formTime", defaultPlaceholder: "Select a time" },
  fileUpload: { nodeType: "formFileUpload" },
};

const CHOICE_VARIANT_MAP: Record<string, string> = {
  checkbox: "checkbox",
  multiChoice: "multiChoice",
  ranking: "ranking",
};

const buildLabelNode = (label: string, required: boolean): TElement =>
  ({
    type: "formLabel",
    required,
    placeholder: "Type a question",
    children: [{ text: label }],
  }) as TElement;

const buildStandardFieldNodes = (
  args: FormBlockArgs,
  nodeType: string,
  defaultPlaceholder?: string,
): TElement[] => {
  const label = buildLabelNode(args.label, args.required ?? false);

  // AI-provided placeholder becomes editable text content inside the field;
  // the node's placeholder attribute stays as the default hint
  const textContent = args.placeholder ?? "";
  const fieldNode = defaultPlaceholder
    ? ({
        type: nodeType,
        placeholder: defaultPlaceholder,
        children: [{ text: textContent }],
      } as TElement)
    : ({ type: nodeType, children: [{ text: textContent }] } as TElement);

  return [label, fieldNode];
};

const buildChoiceFieldNodes = (args: FormBlockArgs, variant: string): TElement[] => {
  const label = buildLabelNode(args.label, args.required ?? false);
  const options = args.options && args.options.length > 0 ? args.options : [""];

  const optionNodes = options.map(
    (text) =>
      ({
        type: "formOptionItem",
        variant,
        children: [{ text }],
      }) as TElement,
  );

  return [label, ...optionNodes, { type: "p", children: [{ text: "" }] } as TElement];
};

const buildMultiSelectNodes = (args: FormBlockArgs): TElement[] => {
  const label = buildLabelNode(args.label, args.required ?? false);
  const options = args.options && args.options.length > 0 ? args.options : [];

  return [
    label,
    {
      type: "formMultiSelectInput",
      options,
      children: [{ text: "" }],
    } as TElement,
    { type: "p", children: [{ text: "" }] } as TElement,
  ];
};

export const buildFormBlockNodes = (args: FormBlockArgs): TElement[] => {
  const { fieldType } = args;

  const standardField = FIELD_TYPE_MAP[fieldType];
  if (standardField) {
    return buildStandardFieldNodes(args, standardField.nodeType, standardField.defaultPlaceholder);
  }

  const choiceVariant = CHOICE_VARIANT_MAP[fieldType];
  if (choiceVariant) {
    return buildChoiceFieldNodes(args, choiceVariant);
  }

  if (fieldType === "multiSelect") {
    return buildMultiSelectNodes(args);
  }

  // Fallback: treat unknown field types as input
  return buildStandardFieldNodes(args, "formInput", "Type Placeholder text");
};

export const buildFormSectionNodes = (args: FormSectionArgs): TElement[] => {
  const level = Number(args.level ?? 2);
  const type = `h${level >= 1 && level <= 3 ? level : 2}`;

  return [{ type, children: [{ text: args.title }] } as TElement];
};
