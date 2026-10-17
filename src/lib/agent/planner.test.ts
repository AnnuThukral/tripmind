import { describe, expect, it } from "vitest";
import type { Itinerary } from "@/lib/schema/trip";
import { TripRequestSchema } from "@/lib/schema/trip";
import type { Place } from "@/lib/tools/places";
import { describeTrip, enforceGroundedPlaces } from "./planner";

const item = (placeId: string | null, title: string) => ({
  time: "10:00",
  type: "activity" as const,
  title,
  placeId,
  placeName: "whatever the model said",
  durationMinutes: 60,
  estimatedCostPerPerson: null,
  whyItFits: "",
  notes: null,
});

describe("enforceGroundedPlaces", () => {
  it("unlinks invented place ids and canonicalizes real ones", () => {
    const known = new Map<string, Place>([
      [
        "osm:node/1",
        { id: "osm:node/1", name: "Real Museum", category: "museums", lat: 0, lon: 0 },
      ],
    ]);
    const itinerary: Itinerary = {
      destination: "X",
      summary: "",
      currency: "EUR",
      estimatedTotalPerPerson: null,
      tips: [],
      days: [
        {
          day: 1,
          date: "2026-11-01",
          theme: "",
          area: "",
          weatherNote: null,
          items: [
            item("osm:node/1", "Museum"),
            item("osm:node/999", "Fake Bar"),
            item(null, "Walk"),
          ],
        },
      ],
    };

    const warnings = enforceGroundedPlaces(itinerary, known);
    const [real, fake, walk] = itinerary.days[0].items;

    expect(real.placeName).toBe("Real Museum");
    expect(fake.placeId).toBeNull();
    expect(walk.placeId).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Fake Bar");
  });
});

describe("describeTrip", () => {
  it("summarizes preferences for the model", () => {
    const trip = TripRequestSchema.parse({
      destination: "Kyoto",
      startDate: "2026-11-01",
      endDate: "2026-11-04",
      travelers: { adults: 1 },
      interests: ["temples", "food"],
      dietary: ["vegetarian"],
      budget: { amount: 100, currency: "usd", per: "day" },
    });
    const text = describeTrip(trip);
    expect(text).toContain("(4 days)");
    expect(text).toContain("temples, food");
    expect(text).toContain("vegetarian");
    expect(text).toContain("100 USD per day");
  });
});
