import { describe, expect, it } from "vitest";
import { TripRequestSchema } from "@/lib/schema/trip";
import type { Place } from "@/lib/tools/places";
import { makeDay, makeItem, makeItinerary } from "@/test/fixtures";
import { MODEL } from "./model";
import { describeTrip, enforceGroundedPlaces, referencedPlaces } from "./planner";

const museum: Place = {
  id: "osm:node/1",
  name: "Real Museum",
  category: "museums",
  lat: 0,
  lon: 0,
};

describe("model", () => {
  it("is pinned to Claude Haiku to keep costs minimal", () => {
    expect(MODEL).toBe("claude-haiku-5-5");
  });
});

describe("enforceGroundedPlaces", () => {
  it("unlinks invented place ids and canonicalizes real ones", () => {
    const known = new Map([[museum.id, museum]]);
    const itinerary = makeItinerary([
      makeDay(1, [
        makeItem({ placeId: "osm:node/1", title: "Museum", placeName: "model's name" }),
        makeItem({ placeId: "osm:node/999", title: "Fake Bar" }),
        makeItem({ title: "Walk" }),
      ]),
    ]);

    const warnings = enforceGroundedPlaces(itinerary, known);
    const [real, fake, walk] = itinerary.days[0].items;

    expect(real.placeName).toBe("Real Museum");
    expect(fake.placeId).toBeNull();
    expect(walk.placeId).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Fake Bar");
    expect(referencedPlaces(itinerary, known)).toEqual({ [museum.id]: museum });
  });
});

describe("describeTrip", () => {
  it("summarizes preferences, passport, origin, and past feedback for the model", () => {
    const trip = TripRequestSchema.parse({
      destination: "Kyoto",
      startDate: "2026-11-01",
      endDate: "2026-11-04",
      travelers: { adults: 1 },
      interests: ["temples", "food"],
      dietary: ["vegetarian"],
      budget: { amount: 100, currency: "usd", per: "day" },
      origin: "Delhi",
      passportCountry: "India",
      feedback: { liked: ["Street food markets"], disliked: ["Long museum visits"] },
    });
    const text = describeTrip(trip);
    expect(text).toContain("(4 days)");
    expect(text).toContain("temples, food");
    expect(text).toContain("vegetarian");
    expect(text).toContain("100 USD per day");
    expect(text).toContain("Passport: India");
    expect(text).toContain("Traveling from: Delhi");
    expect(text).toContain("Past likes: Street food markets");
    expect(text).toContain("Past dislikes: Long museum visits");
  });
});
