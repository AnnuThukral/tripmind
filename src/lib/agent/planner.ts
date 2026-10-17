import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ItinerarySchema,
  tripLengthDays,
  type Itinerary,
  type TripRequest,
} from "@/lib/schema/trip";
import { cachedGeocode, cachedSearchPlaces, cachedWeather } from "@/lib/tools/cached";
import type { GeoResult } from "@/lib/tools/geocode";
import type { Place, PlaceCategory } from "@/lib/tools/places";
import type { WeatherReport } from "@/lib/tools/weather";

// Cheapest current model by default; override with PLANNER_MODEL.
export const DEFAULT_MODEL = "claude-haiku-5-5";

// Data is fetched in code up front and handed to the model in one request.
// An earlier tool-calling loop needed several model turns plus one slow
// Overpass request per category, which overran the serverless time limit.
const SYSTEM_PROMPT = `You are TripMind, an expert travel planner. Build a realistic, personalized day-by-day itinerary from the traveler's preferences, the weather, and the list of real candidate places provided.

Rules:
- Only recommend specific venues from the candidate list, and copy their exact id into placeId. For generic items (a neighborhood walk, hotel rest, transit) use placeId null.
- Cluster each day geographically using the coordinates; avoid zig-zagging across the city.
- Respect pace: relaxed = 3-4 items/day, balanced = 5-6, packed = 7-8 (meals count as items).
- Include breakfast, lunch, and dinner suggestions that respect dietary needs (prefer places tagged with a matching diet).
- Respect opening hours when listed; put indoor options on rainy days.
- Day 1 should be lighter to allow for arrival.
- Costs are rough estimates in the trip currency; use null when you have no basis.
- whyItFits must reference the traveler's stated interests, pace, or constraints.
- If few candidates are available, fill the plan with generic items rather than inventing venues.`;

const ALWAYS_CATEGORIES: PlaceCategory[] = ["sights", "restaurants", "cafes"];

const INTEREST_CATEGORIES: Record<string, PlaceCategory[]> = {
  history: ["museums", "worship"],
  art: ["museums"],
  food: ["street_food"],
  nightlife: ["nightlife"],
  nature: ["nature"],
  hiking: ["nature"],
  beaches: ["nature"],
  shopping: ["shopping"],
  photography: ["nature"],
  wellness: ["nature"],
  architecture: ["worship"],
  family: ["nature", "museums"],
};

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

export function categoriesFor(interests: readonly string[]): PlaceCategory[] {
  const categories = new Set<PlaceCategory>(ALWAYS_CATEGORIES);
  for (const interest of interests) {
    for (const c of INTEREST_CATEGORIES[interest.toLowerCase()] ?? []) categories.add(c);
  }
  return [...categories];
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

export function describeWeather(weather: WeatherReport | null): string {
  if (!weather) return "Weather: unavailable.";
  if (weather.source === "unavailable") return `Weather: ${weather.note}`;
  return [
    "Weather forecast:",
    ...weather.days.map(
      (d) =>
        `- ${d.date}: ${d.summary}, ${Math.round(d.tempMinC)}-${Math.round(d.tempMaxC)}°C` +
        (d.precipitationProbability !== null ? `, ${d.precipitationProbability}% rain` : ""),
    ),
  ].join("\n");
}

/** Compact, one-line-per-place listing to keep the prompt small. */
export function describePlaces(places: readonly Place[]): string {
  if (places.length === 0) return "Candidate places: none available (use generic items).";
  const lines = ["Candidate places (id | name | category | lat,lon | details):"];
  for (const p of places) {
    const details = [
      p.cuisine && `cuisine=${p.cuisine}`,
      p.openingHours && `hours=${p.openingHours}`,
      p.diet && `diet=${p.diet.join(",")}`,
    ]
      .filter(Boolean)
      .join("; ");
    lines.push(
      `${p.id} | ${p.name} | ${p.category} | ${p.lat.toFixed(4)},${p.lon.toFixed(4)}` +
        (details ? ` | ${details}` : ""),
    );
  }
  return lines.join("\n");
}

/**
 * Drop any placeId the model invented: every venue must trace back to a
 * fetched candidate. Returns warnings describing what was removed.
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

async function timed<T>(label: string, work: Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await work;
  } finally {
    console.log(`[planner] ${label}: ${Date.now() - start}ms`);
  }
}

export async function planTrip(
  trip: TripRequest,
  client: Anthropic = new Anthropic(),
): Promise<PlanResult> {
  const model = process.env.PLANNER_MODEL || DEFAULT_MODEL;
  const warnings: string[] = [];

  const geo: GeoResult | null = await timed("geocode", cachedGeocode(trip.destination));
  if (!geo) throw new PlannerError(`Couldn't find "${trip.destination}". Try a city name.`);

  // Weather and places are independent; a failure in either degrades the plan
  // rather than failing it.
  const [weatherResult, placesResult] = await Promise.allSettled([
    timed("weather", cachedWeather(geo.lat, geo.lon, trip.startDate, trip.endDate)),
    timed("places", cachedSearchPlaces(categoriesFor(trip.interests), geo.lat, geo.lon, 4000)),
  ]);
  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const candidates = placesResult.status === "fulfilled" ? placesResult.value : [];
  if (placesResult.status === "rejected") {
    console.error("[planner] places failed", placesResult.reason);
    warnings.push("Place data was unavailable, so no specific venues could be verified.");
  }

  const prompt = [
    describeTrip(trip),
    `Resolved location: ${geo.displayName} (${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)})`,
    describeWeather(weather),
    describePlaces(candidates),
  ].join("\n\n");

  const response = await timed(
    "model",
    client.messages.parse({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(ItinerarySchema) },
    }),
  );

  if (response.stop_reason === "refusal") {
    throw new PlannerError("The model declined this request.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new PlannerError("Itinerary was too long to finish.");
  }
  // Re-validate rather than trusting the helper's parse result alone.
  const parsed = ItinerarySchema.safeParse(response.parsed_output);
  if (!parsed.success) {
    throw new PlannerError("Planner returned an itinerary in the wrong shape.");
  }

  const itinerary = parsed.data;
  const known = new Map(candidates.map((p) => [p.id, p]));
  warnings.push(...enforceGroundedPlaces(itinerary, known));
  const expectedDays = tripLengthDays(trip.startDate, trip.endDate);
  if (itinerary.days.length !== expectedDays) {
    warnings.push(`Expected ${expectedDays} days but got ${itinerary.days.length}.`);
  }

  const places: Record<string, Place> = {};
  for (const day of itinerary.days) {
    for (const item of day.items) {
      if (item.placeId) places[item.placeId] = known.get(item.placeId)!;
    }
  }

  return {
    itinerary,
    places,
    warnings,
    model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
