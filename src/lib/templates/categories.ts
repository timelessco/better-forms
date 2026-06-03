// Fixed gallery taxonomy — free-form tags deferred post-v1 (avoids "survey"/"Survey" fragmentation).
export const TEMPLATE_CATEGORIES = [
  "Survey",
  "Feedback",
  "Registration",
  "Application",
  "Lead Gen",
  "Quiz",
  "Contact",
  "Order/Payment",
  "HR/Recruiting",
  "Education",
  "Other",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const isTemplateCategory = (value: string): value is TemplateCategory =>
  (TEMPLATE_CATEGORIES as readonly string[]).includes(value);
