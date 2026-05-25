import { iconOptions } from "@/components/icon-picker/icon-data";

export const matchIcon = (keyword: string): string | null => {
  if (!keyword) return null;
  const normalized = keyword.toLowerCase().trim();
  const labels = iconOptions.map((opt) => opt.label);

  const exact = labels.find((l) => l === normalized);
  if (exact) return exact;

  const startsWith = labels.find((l) => l.startsWith(normalized));
  if (startsWith) return startsWith;

  const includes = labels.find((l) => l.includes(normalized));
  if (includes) return includes;

  const words = normalized.split(/[\s\-_]+/);
  for (const word of words) {
    if (word.length < 2) continue;
    const wordMatch = labels.find((l) => l.startsWith(word) || l.includes(word));
    if (wordMatch) return wordMatch;
  }

  return null;
};
