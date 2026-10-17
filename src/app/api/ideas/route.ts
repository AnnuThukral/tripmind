import { suggestDestinations } from "@/lib/agent/ideas";
import { aiRoute } from "@/lib/api";
import { IdeasRequestSchema } from "@/lib/schema/ideas";

export const maxDuration = 60;

export function POST(request: Request) {
  return aiRoute(request, "ideas", IdeasRequestSchema, (req) => suggestDestinations(req));
}
