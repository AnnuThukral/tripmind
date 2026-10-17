import { describe, expect, it } from "vitest";
import type { ItineraryDay } from "@/lib/schema/trip";
import { roundCoord } from "@/lib/tools/cached";
import { dayStops } from "./stops";

const item = (time: string, placeId: string | null) => ({
  time,
  type: "activity" as const,
  title: time,
  placeId,
  placeName: null,
  durationMinutes: null,
  estimatedCostPerPerson: null,
  whyItFits: "",
  notes: null,
});

describe("dayStops", () => {
  it("numbers only verified places, in visiting order", () => {
    const day: ItineraryDay = {
      day: 1,
      date: "2026-11-01",
      theme: "",
      area: "",
      weatherNote: null,
      items: [
        item("09:00", null),
        item("10:00", "osm:node/1"),
        item("12:00", "osm:node/unknown"),
        item("14:00", "osm:way/2"),
      ],
    };
    const places = {
      "osm:node/1": { id: "osm:node/1", name: "A", category: "museums" as const, lat: 1, lon: 2 },
      "osm:way/2": { id: "osm:way/2", name: "B", category: "cafes" as const, lat: 3, lon: 4 },
    };
    expect(dayStops(day, places)).toEqual([
      { itemIndex: 1, order: 1, name: "A", time: "10:00", lat: 1, lon: 2 },
      { itemIndex: 3, order: 2, name: "B", time: "14:00", lat: 3, lon: 4 },
    ]);
  });
});

describe("roundCoord", () => {
  it("rounds to 3 decimals so nearby searches share a cache key", () => {
    expect(roundCoord(38.70775)).toBe(38.708);
    expect(roundCoord(-9.13659)).toBe(-9.137);
  });
});
