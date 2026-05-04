// Server-emitted error code surfaced in the 429 body. Mirrored on the client
// so toast wiring can detect quota errors without parsing message text.
export const AI_DAILY_LIMIT_ERROR = "ai_daily_limit_exceeded";
