import type { AnswerAnalysis, AnswerDistributionItem } from "@/types/analytics";

// Pure answer-distribution analysis: given a field's type + raw answers, decide how they collapse
// into a meaningful distribution (donut / domain list / length buckets / Yes-No / top-N). No db
// access — the DB reader (getFormAnswersImpl) tallies rows and calls these to shape the result.

// Categorical fields → donut (capped at 6 + an "Others" bucket). Fields carrying an explicit
// option set are also treated as choice regardless of fieldType (e.g. dropdowns, country pickers).
const ANSWER_CHOICE_TYPES = new Set([
  "MultiChoice",
  "Checkbox",
  "Ranking",
  "Rating",
  "LinearScale",
]);

// Free-text → domain extraction (gmail.com, behance.net): list, not chart.
const ANSWER_DOMAIN_TYPES = new Set(["Email", "Link"]);
// Free-text with no extractable structure → bucket by response length.
const ANSWER_LENGTH_TYPES = new Set(["Input", "Textarea"]);
// Provided-or-not → Yes/No.
const ANSWER_PRESENCE_TYPES = new Set(["FileUpload", "Signature"]);

// Pick how a field's raw answers collapse into a meaningful distribution. Listing every distinct
// free-text answer (8 unique emails, each count 1) is noise — so emails/URLs reduce to domains,
// prose buckets by length, uploads/signatures to Yes/No. Categorical stays a donut.
export const resolveAnalysis = (fieldType: string, hasOptions: boolean): AnswerAnalysis => {
  if (hasOptions || ANSWER_CHOICE_TYPES.has(fieldType)) return "choice";
  if (ANSWER_DOMAIN_TYPES.has(fieldType)) return "domain";
  if (ANSWER_LENGTH_TYPES.has(fieldType)) return "length";
  if (ANSWER_PRESENCE_TYPES.has(fieldType)) return "presence";
  return "raw"; // Number, Date, Time, Phone, Matrix — low-cardinality top-N values
};

// Length buckets (char count of the trimmed answer), short→long, matching the Figma labels.
const LENGTH_BUCKETS: { label: string; max: number }[] = [
  { label: "Very short", max: 20 },
  { label: "Short", max: 60 },
  { label: "Medium", max: 160 },
  { label: "Detailed", max: Number.POSITIVE_INFINITY },
];
export const lengthBucket = (len: number): string =>
  LENGTH_BUCKETS.find((b) => len <= b.max)?.label ?? "Detailed";

export const emailDomain = (raw: string): string => {
  const at = raw.lastIndexOf("@");
  const domain =
    at >= 0
      ? raw
          .slice(at + 1)
          .trim()
          .toLowerCase()
      : "";
  return domain || "other";
};

export const urlDomain = (raw: string): string => {
  const trimmed = raw.trim();
  try {
    const u = new URL(/^[a-z][\w+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return u.hostname.replace(/^www\./, "").toLowerCase() || "other";
  } catch {
    return trimmed.toLowerCase() || "other";
  }
};

// Cap a desc-sorted distribution at `cap`, rolling the tail into an "Others" bucket.
export const capWithOthers = (
  sorted: AnswerDistributionItem[],
  cap: number,
): AnswerDistributionItem[] => {
  if (sorted.length <= cap) return sorted;
  const head = sorted.slice(0, cap);
  const others = sorted.slice(cap).reduce((sum, e) => sum + e.value, 0);
  if (others > 0) head.push({ label: "Others", value: others });
  return head;
};

export const bump = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

// Shape the tallied counts into the final distribution per analysis kind:
// length → fixed buckets in short→long order; presence → Yes/No vs submissions;
// choice/domain → desc + "Others" tail; raw → top 8 distinct values.
export const buildAnswerDistribution = ({
  analysis,
  counts,
  answered,
  submissionCount,
  optionLabel,
}: {
  analysis: AnswerAnalysis;
  counts: Map<string, number>;
  answered: number;
  submissionCount: number;
  optionLabel: (value: string) => string;
}): AnswerDistributionItem[] => {
  if (analysis === "length") {
    return LENGTH_BUCKETS.map((b) => ({ label: b.label, value: counts.get(b.label) ?? 0 })).filter(
      (e) => e.value > 0,
    );
  }
  if (analysis === "presence") {
    return [
      { label: "Yes", value: answered },
      { label: "No", value: Math.max(0, submissionCount - answered) },
    ].filter((e) => e.value > 0);
  }
  const sorted = [...counts.entries()]
    .map(([value, count]) => ({
      label: analysis === "choice" ? optionLabel(value) : value,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);
  return analysis === "raw" ? sorted.slice(0, 8) : capWithOthers(sorted, 6);
};

// Flatten a stored answer (string | number | string[] | matrix record) to present string values.
export const normalizeAnswer = (raw: unknown): string[] => {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((x) => String(x ?? "").trim() !== "").map(String);
  if (typeof raw === "object") {
    const out: string[] = [];
    for (const v of Object.values(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) out.push(...v.filter((x) => String(x ?? "").trim() !== "").map(String));
      else if (String(v ?? "").trim() !== "") out.push(String(v));
    }
    return out;
  }
  const s = String(raw).trim();
  return s === "" ? [] : [s];
};
