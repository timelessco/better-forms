import { describe, expect, it } from "vitest";
import {
  formatNumberValue,
  isFormattingOn,
  parseNumberValue,
} from "@/lib/form-schema/number-format";
import type {
  DecimalSeparator,
  NumberFormatConfig,
  NumberFormatType,
  ThousandsSeparator,
} from "@/lib/form-schema/number-format";

const FORMATS: NumberFormatType[] = ["off", "number", "percent", "usd", "eur", "gbp", "custom"];
const DECIMALS: DecimalSeparator[] = [".", ","];
const THOUSANDS: ThousandsSeparator[] = ["none", "comma", "space"];

describe("isFormattingOn", () => {
  it("false when cfg is undefined", () => {
    expect(isFormattingOn(undefined)).toBe(false);
  });

  it("false when format is off or missing", () => {
    expect(isFormattingOn({})).toBe(false);
    expect(isFormattingOn({ format: "off" })).toBe(false);
  });

  it.each(["number", "percent", "usd", "eur", "gbp", "custom"] as NumberFormatType[])(
    "true for format %s",
    (format) => {
      expect(isFormattingOn({ format })).toBe(true);
    },
  );
});

describe("formatNumberValue exact outputs", () => {
  it('formats "1234.5" as US dollars with comma grouping', () => {
    expect(formatNumberValue("1234.5", { format: "usd", thousandsSeparator: "comma" })).toBe(
      "$1,234.5",
    );
  });

  it("prefixes euro and pound symbols", () => {
    expect(formatNumberValue("1234.5", { format: "eur", thousandsSeparator: "comma" })).toBe(
      "€1,234.5",
    );
    expect(formatNumberValue("1234.5", { format: "gbp", thousandsSeparator: "comma" })).toBe(
      "£1,234.5",
    );
  });

  it("suffixes percent", () => {
    expect(formatNumberValue("1234.5", { format: "percent", thousandsSeparator: "comma" })).toBe(
      "1,234.5%",
    );
  });

  it("number/custom have no affixes", () => {
    expect(formatNumberValue("1234.5", { format: "number", thousandsSeparator: "comma" })).toBe(
      "1,234.5",
    );
    expect(formatNumberValue("1234.5", { format: "custom", thousandsSeparator: "comma" })).toBe(
      "1,234.5",
    );
  });

  it("uses comma decimal + space grouping", () => {
    expect(
      formatNumberValue("1234.5", {
        format: "number",
        decimalSeparator: ",",
        thousandsSeparator: "space",
      }),
    ).toBe("1 234,5");
  });

  it("preserves a leading minus", () => {
    expect(formatNumberValue("-1234.5", { format: "usd", thousandsSeparator: "comma" })).toBe(
      "$-1,234.5",
    );
  });

  it("formats a zero", () => {
    expect(formatNumberValue("0", { format: "usd", thousandsSeparator: "comma" })).toBe("$0");
  });

  it("returns raw unchanged when format is off", () => {
    expect(formatNumberValue("1234.5", { format: "off" })).toBe("1234.5");
    expect(formatNumberValue("1234.5", {})).toBe("1234.5");
  });

  it("returns empty input unchanged", () => {
    expect(formatNumberValue("", { format: "usd" })).toBe("");
  });

  it("returns raw fallback for non-numeric input", () => {
    expect(formatNumberValue("abc", { format: "usd" })).toBe("abc");
  });

  it("does not group integer part shorter than 4 digits", () => {
    expect(formatNumberValue("999", { format: "number", thousandsSeparator: "comma" })).toBe("999");
  });

  it("groups large integers in threes", () => {
    expect(formatNumberValue("1234567", { format: "number", thousandsSeparator: "comma" })).toBe(
      "1,234,567",
    );
  });
});

describe("parseNumberValue strips formatting back to machine form", () => {
  it("strips currency + comma grouping", () => {
    expect(parseNumberValue("$1,234.5", { format: "usd", thousandsSeparator: "comma" })).toBe(
      "1234.5",
    );
  });

  it("strips percent suffix", () => {
    expect(parseNumberValue("1,234.5%", { format: "percent", thousandsSeparator: "comma" })).toBe(
      "1234.5",
    );
  });

  it("handles comma decimal + space grouping", () => {
    expect(
      parseNumberValue("1 234,5", {
        format: "number",
        decimalSeparator: ",",
        thousandsSeparator: "space",
      }),
    ).toBe("1234.5");
  });

  it("keeps only the FIRST decimal separator", () => {
    // With "." decimal, the second "." is dropped (it is not a digit, not the first decimal).
    expect(parseNumberValue("1.2.3", { format: "number" })).toBe("1.23");
  });

  it("with comma decimal, a stray dot is treated as grouping and dropped", () => {
    expect(parseNumberValue("1.234,5", { format: "number", decimalSeparator: "," })).toBe("1234.5");
  });

  it("preserves a leading minus only at the start", () => {
    expect(parseNumberValue("$-1,234.5", { format: "usd", thousandsSeparator: "comma" })).toBe(
      "-1234.5",
    );
    // a minus after digits is ignored
    expect(parseNumberValue("12-3", { format: "number" })).toBe("123");
  });

  it("returns empty for input with no digits", () => {
    expect(parseNumberValue("$", { format: "usd" })).toBe("");
    expect(parseNumberValue("", { format: "usd" })).toBe("");
  });
});

// Machine form: "." decimal, no grouping, leading "-" preserved.
const ROUND_TRIP_VALUES = ["1234.5", "-1234.5", "0", "1000000", "0.25", "-7", "12", "1234567.89"];

const groupCharFor = (sep: ThousandsSeparator): string =>
  sep === "comma" ? "," : sep === "space" ? " " : "";
const decimalCharFor = (sep: DecimalSeparator): string => sep;

// A config is "coherent" only when formatting is ON and the decimal char differs
// from the grouping char. The two excluded cases are contradictory configs the UI
// never produces (their non-invertibility is pinned separately below):
//  - format:"off" — formatNumberValue returns the raw machine string ("." decimal),
//    so parsing it with a "," decimalSeparator is meaningless.
//  - decimalSeparator:"," + thousandsSeparator:"comma" — same char for decimal AND
//    grouping is genuinely ambiguous, so the round-trip can't be inverted.
const isCoherent = (cfg: Required<NumberFormatConfig>): boolean =>
  cfg.format !== "off" &&
  decimalCharFor(cfg.decimalSeparator) !== groupCharFor(cfg.thousandsSeparator);

describe("round-trip identity: parse(format(x)) === x for every coherent config", () => {
  for (const format of FORMATS) {
    for (const decimalSeparator of DECIMALS) {
      for (const thousandsSeparator of THOUSANDS) {
        const cfg: Required<NumberFormatConfig> = { format, decimalSeparator, thousandsSeparator };
        if (!isCoherent(cfg)) continue;
        const label = `${format}/${decimalSeparator}/${thousandsSeparator}`;
        describe(label, () => {
          it.each(ROUND_TRIP_VALUES)("round-trips %s", (x) => {
            const formatted = formatNumberValue(x, cfg);
            expect(parseNumberValue(formatted, cfg)).toBe(x);
          });
        });
      }
    }
  }
});

// Documented (not "correct") behavior for the contradictory configs excluded above.
// These pin the current output so a future change is a conscious decision, not a regression.
describe("incoherent configs — pinned, non-invertible behavior", () => {
  it('format:"off" ignores separators and returns the raw machine string', () => {
    const cfg: NumberFormatConfig = {
      format: "off",
      decimalSeparator: ",",
      thousandsSeparator: "comma",
    };
    expect(formatNumberValue("1234.5", cfg)).toBe("1234.5");
    // parse then reads "." as a non-decimal char (decimalSeparator is ","), dropping it.
    expect(parseNumberValue("1234.5", cfg)).toBe("12345");
  });

  it('decimal "," + grouping "comma" is ambiguous: parse reads the first comma as the decimal', () => {
    const cfg: NumberFormatConfig = {
      format: "number",
      decimalSeparator: ",",
      thousandsSeparator: "comma",
    };
    expect(formatNumberValue("1000000", cfg)).toBe("1,000,000");
    expect(parseNumberValue("1,000,000", cfg)).toBe("1.000000");
  });
});
