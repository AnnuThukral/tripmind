import { reviseItinerary } from "@/lib/agent/revise";
import { aiRoute } from "@/lib/api";
import { RevisionRequestSchema } from "@/lib/schema/trip";

// Place data is usually cached from the original plan, so edits are quicker.
export const maxDuration = 300;

export function POST(request: Request) {
  return aiRoute(request, "edits", RevisionRequestSchema, (req) => reviseItinerary(req));
}
