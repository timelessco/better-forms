import { getCountries, getCountryCallingCode } from "react-phone-number-input";
import en from "react-phone-number-input/locale/en";

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2, e.g. "US" */
  code: string;
  /** Localized country name */
  name: string;
  /** Calling-code digits, no leading "+", e.g. "1", "93" */
  dialCode: string;
  /** Emoji flag derived from the ISO code */
  flag: string;
}

// ISO letter → regional-indicator symbol; a pair renders as the flag emoji.
const toFlagEmoji = (code: string): string =>
  String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));

// All supported countries, name-sorted — backs the editor's "Default country code" picker.
export const PHONE_COUNTRIES: PhoneCountry[] = getCountries()
  .map((code) => ({
    code,
    name: en[code] || code,
    dialCode: getCountryCallingCode(code),
    flag: toFlagEmoji(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
