// Every Claude call in TripMind goes through these constants. The model is
// fixed to Claude Haiku (the cheapest) on purpose and is not configurable via
// env, so a stray setting can't raise costs. See CLAUDE.md before changing.
export const MODEL = "claude-haiku-5-5";

/** Hard ceiling on output (including thinking) per call; bounds worst-case cost. */
export const MAX_OUTPUT_TOKENS = {
  itinerary: 16000,
  revision: 8000,
  suggestions: 4000,
} as const;
