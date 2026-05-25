import { describe, expect, it } from "vitest";
import { isBotUserAgent } from "@/lib/analytics/bot-filter";
import { parseUserAgent } from "@/lib/analytics/parse-user-agent";

describe("isBotUserAgent", () => {
  it("flags Googlebot as bot", () => {
    const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    expect(isBotUserAgent(ua)).toBeTruthy();
  });

  it("flags Bingbot as bot", () => {
    const ua = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";
    expect(isBotUserAgent(ua)).toBeTruthy();
  });

  it("flags Slackbot as bot", () => {
    const ua = "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)";
    expect(isBotUserAgent(ua)).toBeTruthy();
  });

  it("flags Twitterbot as bot", () => {
    const ua = "Twitterbot/1.0";
    expect(isBotUserAgent(ua)).toBeTruthy();
  });

  it("flags facebookexternalhit as bot", () => {
    const ua = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
    expect(isBotUserAgent(ua)).toBeTruthy();
  });

  it("flags AhrefsBot as bot", () => {
    const ua = "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)";
    expect(isBotUserAgent(ua)).toBeTruthy();
  });

  it("flags HeadlessChrome as bot", () => {
    const ua =
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.6099.71 Safari/537.36";
    expect(isBotUserAgent(ua)).toBeTruthy();
  });

  it("flags curl as bot", () => {
    expect(isBotUserAgent("curl/8.4.0")).toBeTruthy();
  });

  it("flags python-requests as bot", () => {
    expect(isBotUserAgent("python-requests/2.31.0")).toBeTruthy();
  });

  it("flags wget as bot", () => {
    expect(isBotUserAgent("Wget/1.21.3")).toBeTruthy();
  });

  it("flags empty string as bot", () => {
    expect(isBotUserAgent("")).toBeTruthy();
  });

  it("flags null as bot", () => {
    expect(isBotUserAgent(null)).toBeTruthy();
  });

  it("flags undefined as bot", () => {
    expect(isBotUserAgent(undefined)).toBeTruthy();
  });

  it("does not flag real Chrome desktop UA", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(isBotUserAgent(ua)).toBeFalsy();
  });

  it("does not flag real Safari iOS UA", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
    expect(isBotUserAgent(ua)).toBeFalsy();
  });

  it("flags WhatsApp link previewer (WhatsApp/2.x) as bot", () => {
    expect(isBotUserAgent("WhatsApp/2.21.4 A")).toBeTruthy();
  });

  it("flags TelegramBot as bot", () => {
    expect(isBotUserAgent("TelegramBot (like TwitterBot)")).toBeTruthy();
  });

  it("flags SemrushBot as bot", () => {
    const ua = "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)";
    expect(isBotUserAgent(ua)).toBeTruthy();
  });

  it("does not flag UA containing the substring 'Robotic' (bot\\b boundary)", () => {
    const ua =
      "Mozilla/5.0 (Robotic Vacuum Browser/1.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
    expect(isBotUserAgent(ua)).toBeFalsy();
  });
});

describe("parseUserAgent", () => {
  it("returns all-null for null UA", () => {
    expect(parseUserAgent(null)).toStrictEqual({
      deviceType: null,
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null,
    });
  });

  it("returns all-null for undefined UA", () => {
    expect(parseUserAgent(undefined)).toStrictEqual({
      deviceType: null,
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null,
    });
  });

  it("returns all-null for empty UA", () => {
    expect(parseUserAgent("")).toStrictEqual({
      deviceType: null,
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null,
    });
  });

  it("parses Chrome 120 desktop on Windows 10", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const result = parseUserAgent(ua);
    expect(result.deviceType).toBe("desktop");
    expect(result.browser).toBe("Chrome");
    expect(result.browserVersion?.startsWith("120")).toBeTruthy();
    expect(result.os).toBe("Windows");
    expect(result.osVersion?.startsWith("10")).toBeTruthy();
  });

  it("parses Safari 16.5 on iPhone iOS 16", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
    const result = parseUserAgent(ua);
    expect(result.deviceType).toBe("mobile");
    expect(result.browser).toBe("Safari");
    expect(result.browserVersion?.startsWith("16")).toBeTruthy();
    expect(result.os).toBe("iOS");
    expect(result.osVersion?.startsWith("16")).toBeTruthy();
  });

  it("parses Safari 17 on iPad iPadOS 17", () => {
    const ua =
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const result = parseUserAgent(ua);
    expect(result.deviceType).toBe("tablet");
    expect(result.browser).toBe("Safari");
    expect(result.os).toBe("iOS");
  });

  it("parses Firefox 121 on Linux", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
    const result = parseUserAgent(ua);
    expect(result.deviceType).toBe("desktop");
    expect(result.browser).toBe("Firefox");
    expect(result.browserVersion?.startsWith("121")).toBeTruthy();
    expect(result.os).toBe("Linux");
  });

  it("parses Edge on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91";
    const result = parseUserAgent(ua);
    expect(result.deviceType).toBe("desktop");
    expect(result.browser).toBe("Edge");
    expect(result.os).toBe("macOS");
  });

  it("parses Opera on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";
    const result = parseUserAgent(ua);
    expect(result.browser).toBe("Opera");
    expect(result.os).toBe("Windows");
  });

  it("parses Chrome on Android phone as mobile", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    const result = parseUserAgent(ua);
    expect(result.deviceType).toBe("mobile");
    expect(result.browser).toBe("Chrome");
    expect(result.os).toBe("Android");
    expect(result.osVersion?.startsWith("13")).toBeTruthy();
  });

  it("parses Chrome on Android tablet (no Mobile token) as tablet", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const result = parseUserAgent(ua);
    expect(result.deviceType).toBe("tablet");
    expect(result.browser).toBe("Chrome");
    expect(result.os).toBe("Android");
  });
});
