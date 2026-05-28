import { customAlphabet } from "nanoid";
import * as v from "valibot";

export const SHORT_ID_LENGTH = 7;
export const SHORT_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const generateShortId = customAlphabet(SHORT_ID_ALPHABET, SHORT_ID_LENGTH);

const SHORT_ID_REGEX = new RegExp(`^[${SHORT_ID_ALPHABET}]{${SHORT_ID_LENGTH}}$`);

export const isValidShortId = (value: string): boolean => SHORT_ID_REGEX.test(value);

export const shortIdSchema = v.pipe(v.string(), v.check(isValidShortId, "Invalid Form Short ID"));
