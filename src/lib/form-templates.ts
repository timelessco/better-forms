import type { TElement } from "platejs";

import { createFormHeaderNode } from "@/lib/form-schema/form-header-factory";
import { buildFormBlockNodes } from "@/lib/editor/ai-form-nodes";

export type FormTemplateId = "blank" | "survey" | "feedback" | "eventRsvp" | "registration";

export type FormTemplateMeta = {
  id: FormTemplateId;
  label: string;
};

/** Visual-only metadata for the quick-create template row. Icons are paired in the UI layer. */
export const FORM_TEMPLATE_META: readonly FormTemplateMeta[] = [
  { id: "blank", label: "Blank Form" },
  { id: "survey", label: "Survey" },
  { id: "feedback", label: "Feedback" },
  { id: "eventRsvp", label: "Event RSVP" },
  { id: "registration", label: "Registration" },
];

const header = (title: string): TElement =>
  createFormHeaderNode({ title, icon: null, cover: null }) as unknown as TElement;

const p = (text: string): TElement => ({ type: "p", children: [{ text }] }) as TElement;

const block = (...args: Parameters<typeof buildFormBlockNodes>): TElement[] =>
  buildFormBlockNodes(...args);

/** Label node shared by the manual field builders below. */
const labelNode = (label: string, required: boolean): TElement =>
  ({
    type: "formLabel",
    required,
    placeholder: "Type a question",
    children: [{ text: label }],
  }) as TElement;

/** NPS-style 1–10 linear scale (buildFormBlockNodes doesn't cover this field type). */
const linearScaleNodes = (label: string): TElement[] => [
  labelNode(label, true),
  {
    type: "formLinearScale",
    scaleMin: 1,
    scaleMax: 10,
    scaleStep: 1,
    children: [{ text: "" }],
  } as TElement,
];

/** 5-star rating (buildFormBlockNodes doesn't cover this field type). */
const ratingNodes = (label: string): TElement[] => [
  labelNode(label, true),
  { type: "formRating", starCount: 5, children: [{ text: "" }] } as TElement,
];

/** Builds pre-seeded Plate content for a template. Each template starts with a header + intro,
 *  followed by relevant starter fields. */
export const buildTemplateContent = (id: FormTemplateId): TElement[] => {
  switch (id) {
    case "blank":
      return [header("Untitled"), p("Start building your form...")];

    case "survey":
      return [
        header("Customer Survey"),
        p("We'd love your feedback. It takes about 2 minutes."),
        ...block({ fieldType: "input", label: "What's your name?", required: false }),
        ...block({ fieldType: "email", label: "Email address", required: true }),
        ...block({
          fieldType: "dropdown",
          label: "How did you hear about us?",
          options: ["Search", "Social media", "Friend", "Other"],
        }),
        ...linearScaleNodes("How satisfied are you?"),
        ...block({
          fieldType: "textarea",
          label: "Any other thoughts?",
          placeholder: "Share your experience...",
        }),
      ];

    case "feedback":
      return [
        header("Feedback"),
        p("Tell us what you think."),
        ...ratingNodes("How would you rate your experience?"),
        ...block({
          fieldType: "textarea",
          label: "What can we improve?",
          placeholder: "Write your feedback...",
        }),
        ...block({ fieldType: "input", label: "Name (optional)", required: false }),
      ];

    case "eventRsvp":
      return [
        header("Event RSVP"),
        p("Let us know if you can make it."),
        ...block({ fieldType: "input", label: "Full name", required: true }),
        ...block({ fieldType: "email", label: "Email", required: true }),
        ...block({
          fieldType: "dropdown",
          label: "Will you attend?",
          options: ["Yes, I'll be there", "Maybe", "No, I can't make it"],
        }),
        ...block({ fieldType: "number", label: "Number of guests", placeholder: "0" }),
        ...block({
          fieldType: "textarea",
          label: "Dietary restrictions",
          placeholder: "Let us know...",
          required: false,
        }),
      ];

    case "registration":
      return [
        header("Registration"),
        p("Sign up in seconds."),
        ...block({ fieldType: "input", label: "Full name", required: true }),
        ...block({ fieldType: "email", label: "Email address", required: true }),
        ...block({ fieldType: "phone", label: "Phone number" }),
        ...block({
          fieldType: "multiChoice",
          label: "Which sessions interest you?",
          options: ["Workshop", "Keynote", "Networking"],
        }),
        ...block({ fieldType: "date", label: "Preferred start date" }),
      ];

    default:
      return [header("Untitled"), p("Start building your form...")];
  }
};
