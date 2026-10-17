import { planTrip } from "@/lib/agent/planner";
import { aiRoute } from "@/lib/api";
import { TripRequestSchema } from "@/lib/schema/trip";

// A slow public Overpass server plus one model call; Vercel Hobby allows up to 300s.
export const maxDuration = 300;

export function POST(request: Request) {
  return aiRoute(request, "trips", TripRequestSchema, (trip) => planTrip(trip));
}
