import Anthropic from "@anthropic-ai/sdk";
import { PlannerError, planTrip } from "@/lib/agent/planner";
import { TripRequestSchema } from "@/lib/schema/trip";
import { UpstreamError } from "@/lib/tools/http";

// Several Overpass lookups plus model turns; public OSM servers can be slow.
export const maxDuration = 120;

export async function POST(request: Request) {
  if (process.env.AI_DISABLED === "true") {
    return Response.json(
      { error: "Trip generation is paused right now. Please try again later." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = TripRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid trip details.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return Response.json(await planTrip(parsed.data));
  } catch (err) {
    if (err instanceof PlannerError) {
      return Response.json({ error: err.message }, { status: 502 });
    }
    if (err instanceof UpstreamError) {
      return Response.json(
        { error: `A travel data service is unavailable (${err.service}). Please retry.` },
        { status: 502 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "We're busy right now. Please retry shortly." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic authentication failed; check ANTHROPIC_API_KEY");
      return Response.json({ error: "The planner is not configured." }, { status: 500 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message);
      return Response.json({ error: "The AI service failed. Please retry." }, { status: 502 });
    }
    console.error(err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
