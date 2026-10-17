import { z } from "zod";
import { MAX_TRIP_DAYS } from "./trip";

export const VIBES = [
  "beach",
  "mountains",
  "city",
  "culture",
  "food",
  "nature",
  "adventure",
  "romance",
  "family",
  "nightlife",
] as const;

export const BUDGET_LEVELS = ["budget", "mid-range", "luxury"] as const;

export const IdeasRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM"),
  tripDays: z.number().int().min(1).max(MAX_TRIP_DAYS),
  vibes: z.array(z.string().trim().min(1).max(30)).min(1).max(6),
  budgetLevel: z.enum(BUDGET_LEVELS).default("mid-range"),
  origin: z.string().trim().min(2).max(120).optional(),
  passportCountry: z.string().trim().min(2).max(60).optional(),
  notes: z.string().trim().max(300).optional(),
});

export type IdeasRequest = z.infer<typeof IdeasRequestSchema>;

export const DestinationIdeaSchema = z.object({
  destination: z.string().describe('"City, Country" so it can be geocoded'),
  why: z.string().describe("Two sentences on why it matches the vibes and month"),
  highlights: z.array(z.string()).describe("3 short highlights"),
  weatherInMonth: z.string(),
  typicalDailyCostUsd: z
    .number()
    .nullable()
    .describe("Per person per day incl. mid-range stay, food, activities"),
  gettingThere: z.string().nullable().describe("Travel time or route from the origin, if given"),
  watchOut: z.string().nullable().describe("Crowds, visa hassle, season caveats"),
});

export const IdeasSchema = z.object({
  ideas: z.array(DestinationIdeaSchema).describe("Exactly 4 varied ideas"),
});

export type DestinationIdea = z.infer<typeof DestinationIdeaSchema>;
