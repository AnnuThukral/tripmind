import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { PlannerError } from "@/lib/agent/planner";
import { quotaGate, type QuotaKind } from "@/lib/rate-limit";
import { UpstreamError } from "@/lib/tools/http";

/**
 * Shared flow for every AI route: kill-switch, JSON + schema validation,
 * daily quota, then the handler, with errors mapped to friendly responses.
 */
export async function aiRoute<S extends z.ZodType, R extends object>(
  request: Request,
  kind: QuotaKind,
  schema: S,
  handler: (input: z.infer<S>) => Promise<R>,
): Promise<Response> {
  if (process.env.AI_DISABLED === "true") {
    return Response.json(
      { error: "TripMind's AI features are paused right now. Please try again later." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid details.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const gate = await quotaGate(kind, request);
  if ("denied" in gate) return gate.denied;

  try {
    return Response.json({ ...(await handler(parsed.data)), remainingToday: gate.remaining });
  } catch (err) {
    return errorResponse(err);
  }
}

export function errorResponse(err: unknown): Response {
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
    return Response.json({ error: "We're busy right now. Please retry shortly." }, { status: 429 });
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
