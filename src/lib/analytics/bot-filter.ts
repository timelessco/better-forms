const BOT_RE =
  /bot\b|crawl|spider|slurp|scrape|headless|http\s*client|preview\s*bot|uptime|pingdom|lighthouse|ahrefs|semrush|externalhit|facebookcatalog|embedly|twitterbot|telegrambot|whatsapp\/\d|tumblr|skypeuripreview|discordbot|slackbot|googlebot|bingbot|yandexbot|baiduspider|curl\/|wget\/|python-requests|node-fetch|axios\/|go-http-client|java\/|okhttp/i;

/** Returns true if the user-agent matches a known bot/crawler/automated-tool pattern. */
export const isBotUserAgent = (ua: string | null | undefined): boolean => {
  if (!ua) {
    return true;
  }
  return BOT_RE.test(ua);
};
