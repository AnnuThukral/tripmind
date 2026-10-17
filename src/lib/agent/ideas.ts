import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { IdeasSchema, type DestinationIdea, type IdeasRequest } from "@/lib/schema/ideas";
import { MAX_OUTPUT_TOKENS, MODEL } from "./model";
import { assertUsable, PlannerError, timed } from "./planner";

const SYSTEM_PROMPT = `You are TripMind, helping a traveler decide where to go. Suggest 4 varied destinations (mix well-known and lesser-known; ideally different countries or regions) that suit the month, trip length, vibes, and budget.

- Be honest about the season: don't suggest places in rainy, monsoon, or extreme-heat season for the given month.
- Respect trip length: from the origin (if given), travel time should be reasonable for the number of days.
- If a passport is given, prefer places with easy entry and mention visa hassle in watchOut when relevant.
- Costs are rough per-person estimates in USD; use null if you can't estimate.`;

export function describeIdeasRequest(req: IdeasRequest): string {
  const [year, month] = req.month.split("-").map(Number);
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en", {
    month: "long",
    timeZone: "UTC",
  });
  const lines = [
    `When: ${monthName} ${year}`,
    `Trip length: ${req.tripDays} day${req.tripDays === 1 ? "" : "s"}`,
    `Vibes: ${req.vibes.join(", ")}`,
    `Budget: ${req.budgetLevel}`,
    `Traveling from: ${req.origin ?? "not specified"}`,
    `Passport: ${req.passportCountry ?? "not specified"}`,
  ];
  if (req.notes) lines.push(`Notes: ${req.notes}`);
  return lines.join("\n");
}

export async function suggestDestinations(
  req: IdeasRequest,
  client: Anthropic = new Anthropic(),
): Promise<{ ideas: DestinationIdea[]; usage: { inputTokens: number; outputTokens: number } }> {
  const response = await timed(
    "ideas",
    client.messages.parse({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS.suggestions,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: describeIdeasRequest(req) }],
      output_config: { format: zodOutputFormat(IdeasSchema) },
    }),
  );
  assertUsable(response.stop_reason);
  const parsed = IdeasSchema.safeParse(response.parsed_output);
  if (!parsed.success || parsed.data.ideas.length === 0) {
    throw new PlannerError("Couldn't come up with ideas. Please try again.");
  }
  return {
    ideas: parsed.data.ideas.slice(0, 4),
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
