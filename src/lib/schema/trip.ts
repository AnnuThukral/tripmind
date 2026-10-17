import { z } from "zod";

export const MAX_TRIP_DAYS = 14;

export const PACES = ["relaxed", "balanced", "packed"] as const;

export const INTERESTS = [
  "history",
  "art",
  "food",
  "nightlife",
  "nature",
  "hiking",
  "beaches",
  "shopping",
  "photography",
  "wellness",
  "architecture",
  "family",
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** What the user tells us about the trip they want. */
export const TripRequestSchema = z
  .object({
    destination: z.string().trim().min(2).max(120),
    startDate: isoDate,
    endDate: isoDate,
    travelers: z.object({
      adults: z.number().int().min(1).max(20),
      children: z.number().int().min(0).max(20).default(0),
    }),
    budget: z
      .object({
        amount: z.number().positive(),
        currency: z.string().length(3).toUpperCase(),
        per: z.enum(["trip", "day"]).default("trip"),
      })
      .optional(),
    interests: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
    pace: z.enum(PACES).default("balanced"),
    dietary: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((t) => t.endDate >= t.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  })
  .refine((t) => tripLengthDays(t.startDate, t.endDate) <= MAX_TRIP_DAYS, {
    message: `Trips are limited to ${MAX_TRIP_DAYS} days for now`,
    path: ["endDate"],
  });

export type TripRequest = z.infer<typeof TripRequestSchema>;

export function tripLengthDays(startDate: string, endDate: string): number {
  const ms = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * The itinerary the planner agent must return. Kept free of numeric/length
 * constraints so it maps cleanly onto structured-output JSON Schema; semantic
 * checks (real place IDs, day count) happen in the agent after parsing.
 */
export const ItineraryItemSchema = z.object({
  time: z.string().describe("Start time, 24h HH:MM"),
  type: z.enum(["activity", "meal", "transport", "rest"]),
  title: z.string(),
  placeId: z
    .string()
    .nullable()
    .describe("Exact `id` returned by search_places, or null if not a specific place"),
  placeName: z.string().nullable(),
  durationMinutes: z.number().nullable(),
  estimatedCostPerPerson: z.number().nullable().describe("In the trip currency"),
  whyItFits: z.string().describe("One sentence linking this pick to the traveler's preferences"),
  notes: z.string().nullable(),
});

export const ItineraryDaySchema = z.object({
  day: z.number(),
  date: z.string().describe("YYYY-MM-DD"),
  theme: z.string(),
  area: z.string().describe("Neighborhood or area the day is clustered in"),
  weatherNote: z.string().nullable(),
  items: z.array(ItineraryItemSchema),
});

export const ItinerarySchema = z.object({
  destination: z.string(),
  summary: z.string(),
  currency: z.string(),
  days: z.array(ItineraryDaySchema),
  estimatedTotalPerPerson: z.number().nullable(),
  tips: z.array(z.string()),
});

export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
