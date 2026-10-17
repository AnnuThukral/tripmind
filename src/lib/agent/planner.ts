import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat, betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { cachedGeocode, cachedSearchPlaces, cachedWeather } from "@/lib/tools/cached";
import { PLACE_CATEGORIES, type Place } from "@/lib/tools/places";
import {
  ItinerarySchema,
  tripLengthDays,
  type Itinerary,
  type TripRequest,
} from "@/lib/schema/trip";

// Cheapest current model by default; override with PLANNER_MODEL.
export const DEFAULT_MODEL = "claude-haiku-5-5";

const SYSTEM_PROMPT = `You are TripMind, an expert travel planner. Build a realistic, personalized day-by-day itinerary.

How to work:
1. Call geocode_destination once to get coordinates.
2. Call get_weather for the trip dates.
3. Call search_places for the categories that match the traveler's interests, plus restaurants or cafes for meals. Use smaller radii around specific neighborhoods to keep each day in one area.
4. Return the itinerary as JSON.

Rules:
- Only recommend specific venues that a search_places call returned, and copy their exact "id" into placeId. For generic items (a walk, hotel rest, transit) use placeId null.
- Cluster each day geographically; avoid zig-zagging across the city.
- Respect pace: relaxed = 3-4 items/day, balanced = 5-6, packed = 7-8 (meals count as items).
- Include breakfast/lunch/dinner suggestions that respect dietary needs.
- Respect openingHours when present; put indoor options on rainy days.
- Day 1 should be lighter to allow for arrival.
- Costs are rough estimates in the trip currency; use null when you have no basis.
- whyItFits must reference the traveler's stated interests, pace, or constraints.`;

export interface PlanResult {
  itinerary: Itinerary;
  /** Verified places referenced by the itinerary, keyed by placeId (for maps and links). */
  places: Record<string, Place>;
  warnings: string[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export class PlannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerError";
  }
}

export function describeTrip(trip: TripRequest): string {
  const days = tripLengthDays(trip.startDate, trip.endDate);
  const lines = [
    `Destination: ${trip.destination}`,
    `Dates: ${trip.startDate} to ${trip.endDate} (${days} day${days === 1 ? "" : "s"})`,
    `Travelers: ${trip.travelers.adults} adult(s), ${trip.travelers.children} child(ren)`,
    `Pace: ${trip.pace}`,
    `Interests: ${trip.interests.length ? trip.interests.join(", ") : "general sightseeing"}`,
    `Dietary needs: ${trip.dietary.length ? trip.dietary.join(", ") : "none"}`,
    trip.budget
      ? `Budget: ${trip.budget.amount} ${trip.budget.currency} per ${trip.budget.per}`
      : "Budget: not specified (assume mid-range, use the local currency)",
  ];
  if (trip.notes) lines.push(`Extra notes from the traveler: ${trip.notes}`);
  return lines.join("\n");
}

/**
 * Drop any placeId the agent invented: every venue must trace back to a
 * search_places result. Returns warnings describing what was removed.
 */
export function enforceGroundedPlaces(
  itinerary: Itinerary,
  known: ReadonlyMap<string, Place>,
): string[] {
  const warnings: string[] = [];
  for (const day of itinerary.days) {
    for (const item of day.items) {
      if (item.placeId && !known.has(item.placeId)) {
        warnings.push(
          `Day ${day.day}: "${item.title}" referenced an unverified place and was unlinked.`,
        );
        item.placeId = null;
      } else if (item.placeId) {
        item.placeName = known.get(item.placeId)!.name;
      }
    }
  }
  return warnings;
}

export async function planTrip(
  trip: TripRequest,
  client: Anthropic = new Anthropic(),
): Promise<PlanResult> {
  const model = process.env.PLANNER_MODEL || DEFAULT_MODEL;
  const knownPlaces = new Map<string, Place>();

  const geocodeTool = betaZodTool({
    name: "geocode_destination",
    description: "Resolve a place name to latitude/longitude and country.",
    inputSchema: z.object({ query: z.string().describe("City or area name") }),
    run: async ({ query }) =>
      JSON.stringify((await cachedGeocode(query)) ?? { error: "not found" }),
  });

  const weatherTool = betaZodTool({
    name: "get_weather",
    description: "Daily weather forecast for the trip dates (up to 16 days ahead).",
    inputSchema: z.object({
      lat: z.number(),
      lon: z.number(),
      startDate: z.string().describe("YYYY-MM-DD"),
      endDate: z.string().describe("YYYY-MM-DD"),
    }),
    run: async ({ lat, lon, startDate, endDate }) =>
      JSON.stringify(await cachedWeather(lat, lon, startDate, endDate)),
  });

  const placesTool = betaZodTool({
    name: "search_places",
    description:
      "Find real, named places near a point from OpenStreetMap. Returns ids to use as placeId.",
    inputSchema: z.object({
      category: z.enum(Object.keys(PLACE_CATEGORIES) as [keyof typeof PLACE_CATEGORIES]),
      lat: z.number(),
      lon: z.number(),
      radiusMeters: z.number().describe("Search radius, 500-8000").optional(),
    }),
    run: async ({ category, lat, lon, radiusMeters }) => {
      const radius = Math.min(Math.max(radiusMeters ?? 3000, 500), 8000);
      const places = await cachedSearchPlaces(category, lat, lon, radius);
      for (const p of places) knownPlaces.set(p.id, p);
      return JSON.stringify(places);
    },
  });

  const runner = client.beta.messages.toolRunner({
    model,
    max_tokens: 16000,
    max_iterations: 12,
    system: SYSTEM_PROMPT,
    tools: [geocodeTool, weatherTool, placesTool],
    output_config: { format: betaZodOutputFormat(ItinerarySchema) },
    messages: [{ role: "user", content: describeTrip(trip) }],
  });

  let inputTokens = 0;
  let outputTokens = 0;
  for await (const message of runner) {
    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;
  }
  const final = await runner.done();

  if (final.stop_reason === "refusal") throw new PlannerError("The model declined this request.");
  if (final.stop_reason === "max_tokens")
    throw new PlannerError("Itinerary was too long to finish.");

  const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PlannerError("Planner did not return valid JSON.");
  }
  const parsed = ItinerarySchema.safeParse(json);
  if (!parsed.success) throw new PlannerError("Planner returned an itinerary in the wrong shape.");

  const itinerary = parsed.data;
  const warnings = enforceGroundedPlaces(itinerary, knownPlaces);
  if (knownPlaces.size === 0) {
    warnings.push("Place data was unavailable, so no specific venues could be verified.");
  }
  const expectedDays = tripLengthDays(trip.startDate, trip.endDate);
  if (itinerary.days.length !== expectedDays) {
    warnings.push(`Expected ${expectedDays} days but got ${itinerary.days.length}.`);
  }

  const places: Record<string, Place> = {};
  for (const day of itinerary.days) {
    for (const item of day.items) {
      if (item.placeId) places[item.placeId] = knownPlaces.get(item.placeId)!;
    }
  }

  return { itinerary, places, warnings, model, usage: { inputTokens, outputTokens } };
}
