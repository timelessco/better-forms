export type DeviceType = "desktop" | "mobile" | "tablet";
export type BrowserName = "Chrome" | "Firefox" | "Safari" | "Edge" | "Opera" | "Other";
export type OSName = "Windows" | "macOS" | "iOS" | "Android" | "Linux" | "Other";

export interface ParsedUA {
  deviceType: DeviceType | null;
  browser: BrowserName | null;
  browserVersion: string | null;
  os: OSName | null;
  osVersion: string | null;
}

// Browser detection regexes — order matters: Edge/Opera before Chrome,
// Chrome before Safari (Chrome UAs include "Safari/").
const RE_EDGE = /Edg(?:e|A|iOS)?\/([\d.]+)/;
const RE_OPERA = /(?:OPR|Opera)\/([\d.]+)/;
const RE_FIREFOX = /Firefox\/([\d.]+)/;
const RE_CHROME = /Chrome\/([\d.]+)/;
const RE_SAFARI_VERSION = /Version\/([\d.]+).+Safari/;
const RE_SAFARI_FALLBACK = /Safari\/([\d.]+)/;

// OS detection regexes — order matters: iOS before macOS, Android before Linux.
const RE_IPHONE = /iPhone OS (\d+(?:[._]\d+)*)/;
const RE_IPAD = /(?:iPad;.*?CPU OS |CPU iPad OS )(\d+(?:[._]\d+)*)/;
const RE_ANDROID = /Android (\d+(?:\.\d+)*)/;
const RE_WINDOWS = /Windows NT (\d+(?:\.\d+)*)/;
const RE_MACOS = /Mac OS X (\d+(?:[._]\d+)*)/;
const RE_LINUX = /Linux/;

// Device detection.
// NOTE: iPadOS 13+ defaults to a "Macintosh" UA with no iPad token. We classify
// these as macOS/desktop in v1; client hints would be needed to detect them.
const RE_IPAD_TOKEN = /iPad/;
const RE_IPHONE_TOKEN = /iPhone|iPod/;
const RE_ANDROID_TOKEN = /Android/;
const RE_MOBILE_TOKEN = /Mobile/;

// Version normalization (iOS/macOS use underscores: 16_5 → 16.5).
const RE_UNDERSCORE = /_/g;

const EMPTY_PARSED: ParsedUA = {
  deviceType: null,
  browser: null,
  browserVersion: null,
  os: null,
  osVersion: null,
};

const detectBrowser = (ua: string): { browser: BrowserName; browserVersion: string | null } => {
  const edgeMatch = ua.match(RE_EDGE);
  if (edgeMatch) {
    return { browser: "Edge", browserVersion: edgeMatch[1] ?? null };
  }
  const operaMatch = ua.match(RE_OPERA);
  if (operaMatch) {
    return { browser: "Opera", browserVersion: operaMatch[1] ?? null };
  }
  const firefoxMatch = ua.match(RE_FIREFOX);
  if (firefoxMatch) {
    return { browser: "Firefox", browserVersion: firefoxMatch[1] ?? null };
  }
  const chromeMatch = ua.match(RE_CHROME);
  if (chromeMatch) {
    return { browser: "Chrome", browserVersion: chromeMatch[1] ?? null };
  }
  const safariVersionMatch = ua.match(RE_SAFARI_VERSION);
  if (safariVersionMatch) {
    return {
      browser: "Safari",
      browserVersion: safariVersionMatch[1] ?? null,
    };
  }
  const safariMatch = ua.match(RE_SAFARI_FALLBACK);
  if (safariMatch) {
    return { browser: "Safari", browserVersion: safariMatch[1] ?? null };
  }
  return { browser: "Other", browserVersion: null };
};

const normalizeVersion = (raw: string): string => raw.replace(RE_UNDERSCORE, ".");

const detectOS = (ua: string): { os: OSName; osVersion: string | null } => {
  // iOS first — iPad/iPhone tokens may also coexist with Mac substring.
  const ipadMatch = ua.match(RE_IPAD);
  if (ipadMatch || RE_IPAD_TOKEN.test(ua)) {
    return {
      os: "iOS",
      osVersion: ipadMatch ? normalizeVersion(ipadMatch[1] ?? "") : null,
    };
  }
  const iphoneMatch = ua.match(RE_IPHONE);
  if (iphoneMatch) {
    return {
      os: "iOS",
      osVersion: normalizeVersion(iphoneMatch[1] ?? ""),
    };
  }
  // Android before Linux (Android UAs include "Linux").
  const androidMatch = ua.match(RE_ANDROID);
  if (androidMatch) {
    return { os: "Android", osVersion: androidMatch[1] ?? null };
  }
  const windowsMatch = ua.match(RE_WINDOWS);
  if (windowsMatch) {
    return { os: "Windows", osVersion: windowsMatch[1] ?? null };
  }
  const macMatch = ua.match(RE_MACOS);
  if (macMatch) {
    return {
      os: "macOS",
      osVersion: normalizeVersion(macMatch[1] ?? ""),
    };
  }
  if (RE_LINUX.test(ua)) {
    return { os: "Linux", osVersion: null };
  }
  return { os: "Other", osVersion: null };
};

const detectDevice = (ua: string): DeviceType => {
  if (RE_IPAD_TOKEN.test(ua)) {
    return "tablet";
  }
  if (RE_IPHONE_TOKEN.test(ua)) {
    return "mobile";
  }
  if (RE_ANDROID_TOKEN.test(ua)) {
    return RE_MOBILE_TOKEN.test(ua) ? "mobile" : "tablet";
  }
  if (RE_MOBILE_TOKEN.test(ua)) {
    return "mobile";
  }
  return "desktop";
};

export const parseUserAgent = (ua: string | null | undefined): ParsedUA => {
  if (!ua) {
    return { ...EMPTY_PARSED };
  }
  const { browser, browserVersion } = detectBrowser(ua);
  const { os, osVersion } = detectOS(ua);
  const deviceType = detectDevice(ua);
  return { deviceType, browser, browserVersion, os, osVersion };
};
