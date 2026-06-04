// Number-field "Format" option (block menu) — display formatting for the live form.
// The stored value stays a plain machine number (e.g. "1234.5"); formatting only affects display.

export type NumberFormatType = "off" | "number" | "percent" | "usd" | "eur" | "gbp" | "custom";
export type DecimalSeparator = "." | ",";
export type ThousandsSeparator = "none" | "comma" | "space";

export interface NumberFormatConfig {
  format?: NumberFormatType;
  decimalSeparator?: DecimalSeparator;
  thousandsSeparator?: ThousandsSeparator;
}

const CURRENCY_PREFIX: Partial<Record<NumberFormatType, string>> = {
  usd: "$",
  eur: "€",
  gbp: "£",
};

export const isFormattingOn = (cfg: NumberFormatConfig | undefined): boolean =>
  !!cfg && (cfg.format ?? "off") !== "off";

const groupChar = (sep: ThousandsSeparator | undefined): string =>
  sep === "comma" ? "," : sep === "space" ? " " : "";

const decimalChar = (sep: DecimalSeparator | undefined): string => (sep === "," ? "," : ".");

/**
 * Format a machine number string ("1234.5", "." decimal, no grouping) for display.
 * Returns the input unchanged when formatting is off or the value is empty/non-numeric.
 */
export const formatNumberValue = (raw: string, cfg: NumberFormatConfig): string => {
  const format = cfg.format ?? "off";
  if (format === "off" || raw === "") return raw;
  const negative = raw.trim().startsWith("-");
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (cleaned === "") return raw;
  const [intPart = "", decPart] = cleaned.split(".");
  const grouped = groupChar(cfg.thousandsSeparator)
    ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, groupChar(cfg.thousandsSeparator))
    : intPart;
  let body =
    decPart !== undefined ? `${grouped}${decimalChar(cfg.decimalSeparator)}${decPart}` : grouped;
  if (negative) body = `-${body}`;
  const prefix = CURRENCY_PREFIX[format];
  if (prefix) return `${prefix}${body}`;
  if (format === "percent") return `${body}%`;
  return body; // number, custom
};

/**
 * Parse a formatted display string back to a machine number string ("." decimal, no grouping).
 * Strips currency symbols, percent, and thousands separators; keeps the first decimal separator.
 */
export const parseNumberValue = (formatted: string, cfg: NumberFormatConfig): string => {
  const dec = decimalChar(cfg.decimalSeparator);
  let out = "";
  let seenDecimal = false;
  for (const ch of formatted) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "-" && out === "") out += "-";
    else if (ch === dec && !seenDecimal) {
      out += ".";
      seenDecimal = true;
    }
  }
  return out;
};
