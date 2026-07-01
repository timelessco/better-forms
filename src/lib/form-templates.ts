import type { TElement } from "platejs";

import { createFormHeaderNode } from "@/lib/form-schema/form-header-factory";
import { buildFormBlockNodes } from "@/lib/editor/ai-form-nodes";

export type FormTemplateId =
  | "blank"
  | "survey"
  | "feedback"
  | "eventRsvp"
  | "registration"
  | "contact"
  | "jobApplication"
  | "newsletter"
  | "bugReport"
  | "orderForm"
  | "courseEnrollment"
  | "leadGen";

export type FormTemplateCategory =
  | "general"
  | "feedback"
  | "events"
  | "registration"
  | "hr"
  | "sales"
  | "education";

export type FormTemplateMeta = {
  id: FormTemplateId;
  label: string;
  /** Short blurb shown on the gallery card + preview sidebar. */
  description: string;
  category: FormTemplateCategory;
  /** Free-text tags powering gallery search. */
  tags: readonly string[];
  /** Card cover — image URL or hex color. null falls back to the default cover image. */
  cover: string | null;
  /** Gallery-card thumbnail: a pre-rendered preview of the seeded form (public/template-previews/).
   *  Takes precedence over `cover` on the card; `cover` still drives the detail-page form cover. */
  thumbnail?: string | null;
  /** Dark-mode variant of `thumbnail`; the card swaps to it under `.dark`. */
  thumbnailDark?: string | null;
  /** Author shown on the card. All built-ins are authored by Reform for now. */
  creator: string;
  /** When true, also pinned in the dashboard quick-create row. */
  featured?: boolean;
};

// Human-readable category labels for the gallery filter.
export const FORM_TEMPLATE_CATEGORY_LABEL: Record<FormTemplateCategory, string> = {
  general: "General",
  feedback: "Feedback",
  events: "Events",
  registration: "Registration",
  hr: "HR",
  sales: "Sales",
  education: "Education",
};

// Per-category cover tint so gallery cards read distinctly at a glance.
const COVER = {
  feedback: "#6366F1",
  events: "#EC4899",
  registration: "#14B8A6",
  hr: "#F59E0B",
  sales: "#3B82F6",
  education: "#8B5CF6",
} as const;

/** Curated built-in templates. `featured` ones also surface in the dashboard quick row. */
export const FORM_TEMPLATE_META: readonly FormTemplateMeta[] = [
  {
    id: "blank",
    label: "Blank Form",
    description: "Start from scratch with an empty form.",
    category: "general",
    tags: ["empty", "scratch"],
    cover: null,
    creator: "Reform",
    featured: true,
  },
  {
    id: "survey",
    label: "Survey",
    description: "Gather structured feedback with a short, multi-question survey.",
    category: "feedback",
    tags: ["survey", "nps", "csat", "research"],
    cover: COVER.feedback,
    thumbnail: "/template-previews/survey.png",
    thumbnailDark: "/template-previews/survey-dark.png",
    creator: "Reform",
    featured: true,
  },
  {
    id: "feedback",
    label: "Feedback",
    description: "Collect ratings and open-ended feedback in seconds.",
    category: "feedback",
    tags: ["feedback", "rating", "reviews"],
    cover: COVER.feedback,
    thumbnail: "/template-previews/feedback.png",
    thumbnailDark: "/template-previews/feedback-dark.png",
    creator: "Reform",
    featured: true,
  },
  {
    id: "eventRsvp",
    label: "Event RSVP",
    description: "Confirm attendance, guest counts, and dietary needs for an event.",
    category: "events",
    tags: ["rsvp", "event", "invite", "attendance"],
    cover: COVER.events,
    thumbnail: "/template-previews/eventRsvp.png",
    thumbnailDark: "/template-previews/eventRsvp-dark.png",
    creator: "Reform",
    featured: true,
  },
  {
    id: "registration",
    label: "Registration",
    description: "Sign attendees up and capture their session preferences.",
    category: "registration",
    tags: ["registration", "signup", "sessions"],
    cover: COVER.registration,
    thumbnail: "/template-previews/registration.png",
    thumbnailDark: "/template-previews/registration-dark.png",
    creator: "Reform",
  },
  {
    id: "contact",
    label: "Contact Us",
    description: "A simple contact form for inbound questions and requests.",
    category: "sales",
    tags: ["contact", "support", "inquiry"],
    cover: COVER.sales,
    thumbnail: "/template-previews/contact.png",
    thumbnailDark: "/template-previews/contact-dark.png",
    creator: "Reform",
  },
  {
    id: "jobApplication",
    label: "Job Application",
    description: "Collect applicant details, resume, and a short cover note.",
    category: "hr",
    tags: ["job", "hiring", "application", "resume"],
    cover: COVER.hr,
    thumbnail: "/template-previews/jobApplication.png",
    thumbnailDark: "/template-previews/jobApplication-dark.png",
    creator: "Reform",
  },
  {
    id: "newsletter",
    label: "Newsletter Signup",
    description: "Grow your list with a focused email opt-in.",
    category: "sales",
    tags: ["newsletter", "email", "subscribe", "marketing"],
    cover: COVER.sales,
    thumbnail: "/template-previews/newsletter.png",
    thumbnailDark: "/template-previews/newsletter-dark.png",
    creator: "Reform",
  },
  {
    id: "bugReport",
    label: "Bug Report",
    description: "Let users report issues with steps, severity, and screenshots.",
    category: "feedback",
    tags: ["bug", "report", "issue", "support"],
    cover: COVER.feedback,
    thumbnail: "/template-previews/bugReport.png",
    thumbnailDark: "/template-previews/bugReport-dark.png",
    creator: "Reform",
  },
  {
    id: "orderForm",
    label: "Order Form",
    description: "Take product orders with quantity, shipping, and contact details.",
    category: "sales",
    tags: ["order", "ecommerce", "purchase", "checkout"],
    cover: COVER.sales,
    thumbnail: "/template-previews/orderForm.png",
    thumbnailDark: "/template-previews/orderForm-dark.png",
    creator: "Reform",
  },
  {
    id: "courseEnrollment",
    label: "Course Enrollment",
    description: "Enroll students and capture their track and experience level.",
    category: "education",
    tags: ["course", "enrollment", "education", "students"],
    cover: COVER.education,
    thumbnail: "/template-previews/courseEnrollment.png",
    thumbnailDark: "/template-previews/courseEnrollment-dark.png",
    creator: "Reform",
  },
  {
    id: "leadGen",
    label: "Lead Generation",
    description: "Qualify inbound leads with company, budget, and intent.",
    category: "sales",
    tags: ["lead", "sales", "b2b", "qualify"],
    cover: COVER.sales,
    thumbnail: "/template-previews/leadGen.png",
    thumbnailDark: "/template-previews/leadGen-dark.png",
    creator: "Reform",
  },
];

/** Lookup helper — returns the template meta for an id, or undefined. */
export const findTemplateMeta = (id: string): FormTemplateMeta | undefined =>
  FORM_TEMPLATE_META.find((t) => t.id === id);

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

    case "contact":
      return [
        header("Contact Us"),
        p("Have a question? Send us a message and we'll get back to you."),
        ...block({ fieldType: "input", label: "Your name", required: true }),
        ...block({ fieldType: "email", label: "Email address", required: true }),
        ...block({
          fieldType: "dropdown",
          label: "What's this about?",
          options: ["Sales", "Support", "Partnership", "Other"],
        }),
        ...block({
          fieldType: "textarea",
          label: "Message",
          placeholder: "How can we help?",
          required: true,
        }),
      ];

    case "jobApplication":
      return [
        header("Job Application"),
        p("We're excited to learn more about you."),
        ...block({ fieldType: "input", label: "Full name", required: true }),
        ...block({ fieldType: "email", label: "Email address", required: true }),
        ...block({ fieldType: "phone", label: "Phone number" }),
        ...block({ fieldType: "link", label: "LinkedIn or portfolio" }),
        ...block({ fieldType: "fileUpload", label: "Upload your resume", required: true }),
        ...block({
          fieldType: "textarea",
          label: "Why are you a great fit?",
          placeholder: "A few sentences...",
        }),
      ];

    case "newsletter":
      return [
        header("Newsletter Signup"),
        p("Get the latest updates straight to your inbox."),
        ...block({ fieldType: "input", label: "First name", required: false }),
        ...block({ fieldType: "email", label: "Email address", required: true }),
        ...block({
          fieldType: "multiSelect",
          label: "What are you interested in?",
          options: ["Product updates", "Tips & guides", "Events", "Offers"],
        }),
      ];

    case "bugReport":
      return [
        header("Bug Report"),
        p("Found something broken? Help us fix it."),
        ...block({ fieldType: "input", label: "Summary", required: true }),
        ...block({
          fieldType: "dropdown",
          label: "Severity",
          options: ["Critical", "High", "Medium", "Low"],
        }),
        ...block({
          fieldType: "textarea",
          label: "Steps to reproduce",
          placeholder: "1. Go to...\n2. Click...",
          required: true,
        }),
        ...block({ fieldType: "fileUpload", label: "Screenshots", required: false }),
        ...block({ fieldType: "email", label: "Your email (for follow-up)", required: false }),
      ];

    case "orderForm":
      return [
        header("Order Form"),
        p("Place your order below."),
        ...block({ fieldType: "input", label: "Full name", required: true }),
        ...block({ fieldType: "email", label: "Email address", required: true }),
        ...block({
          fieldType: "dropdown",
          label: "Product",
          options: ["Starter", "Pro", "Enterprise"],
        }),
        ...block({ fieldType: "number", label: "Quantity", placeholder: "1" }),
        ...block({
          fieldType: "textarea",
          label: "Shipping address",
          placeholder: "Street, city, postal code",
          required: true,
        }),
      ];

    case "courseEnrollment":
      return [
        header("Course Enrollment"),
        p("Reserve your spot in the program."),
        ...block({ fieldType: "input", label: "Full name", required: true }),
        ...block({ fieldType: "email", label: "Email address", required: true }),
        ...block({
          fieldType: "dropdown",
          label: "Which track?",
          options: ["Beginner", "Intermediate", "Advanced"],
        }),
        ...block({
          fieldType: "multiChoice",
          label: "Experience level",
          options: ["New to this", "Some experience", "Experienced"],
        }),
        ...block({ fieldType: "date", label: "Preferred start date" }),
      ];

    case "leadGen":
      return [
        header("Get in Touch"),
        p("Tell us about your needs and we'll reach out."),
        ...block({ fieldType: "input", label: "Full name", required: true }),
        ...block({ fieldType: "email", label: "Work email", required: true }),
        ...block({ fieldType: "input", label: "Company", required: true }),
        ...block({
          fieldType: "dropdown",
          label: "Estimated budget",
          options: ["< $1k", "$1k–$10k", "$10k–$50k", "$50k+"],
        }),
        ...block({
          fieldType: "textarea",
          label: "What are you looking to achieve?",
          placeholder: "Tell us more...",
        }),
      ];

    default:
      return [header("Untitled"), p("Start building your form...")];
  }
};
