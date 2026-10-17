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
import { MAX_OUTPUT_TOKENS, MODEL } from "./model";

// Data is fetched in code up front and handed to the model in one request.
// An earlier tool-calling loop needed several model turns plus one slow
// Overpass request per category, which overran the serverless time limit.
export const PLANNING_RULES = `Rules:
- Only recommend specific venues from the candidate list, and copy their exact id into placeId. For generic items (a neighborhood walk, hotel rest, transit) use placeId null. Never invent venue names.
- Cluster each day geographically using the coordinates; avoid zig-zagging across the city.
- Respect pace: relaxed = 3-4 items/day, balanced = 5-6, packed = 7-8 (meals count as items).
- Day 1 must be lighter than the other days (at least one item fewer) to allow for arrival, unless the trip is a single day.
- Include breakfast, lunch, and dinner suggestions that respect dietary needs. Prefer places tagged with a matching diet or a naturally suitable cuisine.
- Prefer independent, local places. Avoid international chains (e.g. Hard Rock Cafe, McDonald's, Starbucks) unless nothing else fits.
- Respect opening hours when listed; put indoor options on rainy days.
- Costs are rough estimates in the trip currency; use null when you have no basis.
- whyItFits must reference the traveler's stated interests, pace, constraints, or past likes.
- Avoid things similar to the traveler's past dislikes.
- If few candidates are available, fill the plan with generic items rather than inventing venues.`;

const SYSTEM_PROMPT = `You are TripMind, an expert travel planner. Build a realistic, personalized day-by-day itinerary from the traveler's preferences, the weather, and the list of real candidate places provided.

${PLANNING_RULES}

Also provide:
- stay: the best neighborhood to stay in given where the days are clustered, with alternatives and a typical nightly price.
- packingList: tailored to the forecast and planned activities.
- essentials: practical pre-trip info. For entry requirements, give your best understanding for the traveler's passport and always tell them to confirm with the official government or embassy website, since rules change.`;

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
  /** Free trip plans left today for this visitor, when known. */
  remainingToday?: number;
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
    `Passport: ${trip.passportCountry ?? "not specified"}`,
  ];
  if (trip.origin) lines.push(`Traveling from: ${trip.origin}`);
  if (trip.feedback?.liked.length) lines.push(`Past likes: ${trip.feedback.liked.join("; ")}`);
  if (trip.feedback?.disliked.length) {
    lines.push(`Past dislikes: ${trip.feedback.disliked.join("; ")}`);
  }
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
  itinerary: Pick<Itinerary, "days">,
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

/** Verified places referenced by the given days, keyed by placeId. */
export function referencedPlaces(
  itinerary: Pick<Itinerary, "days">,
  known: ReadonlyMap<string, Place>,
): Record<string, Place> {
  const places: Record<string, Place> = {};
  for (const day of itinerary.days) {
    for (const item of day.items) {
      const place = item.placeId ? known.get(item.placeId) : undefined;
      if (place) places[place.id] = place;
    }
  }
  return places;
}

export async function timed<T>(label: string, work: Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await work;
  } finally {
    console.log(`[planner] ${label}: ${Date.now() - start}ms`);
  }
}

export interface TripContext {
  geo: GeoResult;
  weather: WeatherReport | null;
  candidates: Place[];
  warnings: string[];
}

/** Location, weather, and candidate places for a trip. Cached, so cheap to repeat. */
export async function gatherContext(trip: TripRequest): Promise<TripContext> {
  const geo = await timed("geocode", cachedGeocode(trip.destination));
  if (!geo) throw new PlannerError(`Couldn't find "${trip.destination}". Try a city name.`);

  // Weather and places are independent; a failure in either degrades the plan
  // rather than failing it.
  const [weatherResult, placesResult] = await Promise.allSettled([
    timed("weather", cachedWeather(geo.lat, geo.lon, trip.startDate, trip.endDate)),
    timed("places", cachedSearchPlaces(categoriesFor(trip.interests), geo.lat, geo.lon, 4000)),
  ]);
  const warnings: string[] = [];
  if (placesResult.status === "rejected") {
    console.error("[planner] places failed", placesResult.reason);
    warnings.push("Place data was unavailable, so no specific venues could be verified.");
  }
  return {
    geo,
    weather: weatherResult.status === "fulfilled" ? weatherResult.value : null,
    candidates: placesResult.status === "fulfilled" ? placesResult.value : [],
    warnings,
  };
}

export function describeContext(trip: TripRequest, ctx: TripContext): string {
  return [
    describeTrip(trip),
    `Resolved location: ${ctx.geo.displayName} (${ctx.geo.lat.toFixed(4)}, ${ctx.geo.lon.toFixed(4)})`,
    describeWeather(ctx.weather),
    describePlaces(ctx.candidates),
  ].join("\n\n");
}

/** Shared checks on a structured-output response before trusting its content. */
export function assertUsable(stopReason: string | null): void {
  if (stopReason === "refusal") throw new PlannerError("The model declined this request.");
  if (stopReason === "max_tokens") throw new PlannerError("The response was too long to finish.");
}

export async function planTrip(
  trip: TripRequest,
  client: Anthropic = new Anthropic(),
): Promise<PlanResult> {
  const ctx = await gatherContext(trip);
  const warnings = [...ctx.warnings];

  const response = await timed(
    "model",
    client.messages.parse({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.itinerary,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: describeContext(trip, ctx) }],
      output_config: { format: zodOutputFormat(ItinerarySchema) },
    }),
  );
  assertUsable(response.stop_reason);

  // Re-validate rather than trusting the helper's parse result alone.
  const parsed = ItinerarySchema.safeParse(response.parsed_output);
  if (!parsed.success) {
    throw new PlannerError("Planner returned an itinerary in the wrong shape.");
  }

  const itinerary = parsed.data;
  const known = new Map(ctx.candidates.map((p) => [p.id, p]));
  warnings.push(...enforceGroundedPlaces(itinerary, known));
  const expectedDays = tripLengthDays(trip.startDate, trip.endDate);
  if (itinerary.days.length !== expectedDays) {
    warnings.push(`Expected ${expectedDays} days but got ${itinerary.days.length}.`);
  }

  return {
    itinerary,
    places: referencedPlaces(itinerary, known),
    warnings,
    model: MODEL,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
