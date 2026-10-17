import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  RevisionSchema,
  type Itinerary,
  type ItineraryDay,
  type RevisionRequest,
} from "@/lib/schema/trip";
import type { Place } from "@/lib/tools/places";
import { MAX_OUTPUT_TOKENS, MODEL } from "./model";
import {
  assertUsable,
  describeContext,
  enforceGroundedPlaces,
  gatherContext,
  PLANNING_RULES,
  PlannerError,
  referencedPlaces,
  timed,
} from "./planner";

const SYSTEM_PROMPT = `You are TripMind, editing an existing travel itinerary at the traveler's request.

Change only what the request needs. Return only the days you changed, each with its complete list of items, keeping each day's "day" number and "date" exactly as they were. Leave everything else alone.

${PLANNING_RULES}`;

export interface ReviseResult {
  itinerary: Itinerary;
  /** Verified places for the changed days only; merge with the existing map. */
  places: Record<string, Place>;
  changedDays: number[];
  note: string;
  warnings: string[];
  usage: { inputTokens: number; outputTokens: number };
}

/** Days only, compact, so the model sees the current plan without the extras. */
export function describeCurrentPlan(itinerary: Itinerary): string {
  const lines = ["Current itinerary:"];
  for (const day of itinerary.days) {
    lines.push(`Day ${day.day} (${day.date}) - ${day.theme} - area: ${day.area}`);
    for (const item of day.items) {
      lines.push(
        `  ${item.time} [${item.type}] ${item.title}${item.placeId ? ` {${item.placeId}}` : ""}`,
      );
    }
  }
  return lines.join("\n");
}

/**
 * Replace days by number. Day numbers the itinerary doesn't have are ignored,
 * and dates always come from the original so the model can't move days.
 */
export function mergeDays(itinerary: Itinerary, changed: ItineraryDay[]): Itinerary {
  const byNumber = new Map(changed.map((d) => [d.day, d]));
  return {
    ...itinerary,
    days: itinerary.days.map((day) => {
      const replacement = byNumber.get(day.day);
      return replacement ? { ...replacement, day: day.day, date: day.date } : day;
    }),
  };
}

export async function reviseItinerary(
  request: RevisionRequest,
  client: Anthropic = new Anthropic(),
): Promise<ReviseResult> {
  const { trip, itinerary, instruction } = request;
  const ctx = await gatherContext(trip);

  const prompt = [
    describeContext(trip, ctx),
    describeCurrentPlan(itinerary),
    `Traveler's request: ${instruction}`,
  ].join("\n\n");

  const response = await timed(
    "revise",
    client.messages.parse({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.revision,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(RevisionSchema) },
    }),
  );
  assertUsable(response.stop_reason);

  const parsed = RevisionSchema.safeParse(response.parsed_output);
  if (!parsed.success) throw new PlannerError("The edit came back in the wrong shape.");

  const existing = new Set(itinerary.days.map((d) => d.day));
  const changed = parsed.data.days.filter((d) => existing.has(d.day));
  if (changed.length === 0) {
    throw new PlannerError("Couldn't apply that change. Try rephrasing it.");
  }

  const known = new Map(ctx.candidates.map((p) => [p.id, p]));
  const warnings = [...ctx.warnings, ...enforceGroundedPlaces({ days: changed }, known)];

  return {
    itinerary: mergeDays(itinerary, changed),
    places: referencedPlaces({ days: changed }, known),
    changedDays: changed.map((d) => d.day),
    note: parsed.data.note,
    warnings,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
