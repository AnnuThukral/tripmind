import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TripRequestSchema, type Itinerary } from "@/lib/schema/trip";
import { categoriesFor, describePlaces, planTrip, PlannerError } from "./planner";

vi.mock("@/lib/tools/cached", () => ({
  cachedGeocode: vi.fn(),
  cachedWeather: vi.fn(),
  cachedSearchPlaces: vi.fn(),
}));
const cached = await import("@/lib/tools/cached");

const trip = TripRequestSchema.parse({
  destination: "Lisbon",
  startDate: "2026-11-01",
  endDate: "2026-11-01",
  travelers: { adults: 2 },
  interests: ["history"],
});

const museum = {
  id: "osm:node/1",
  name: "Real Museum",
  category: "museums" as const,
  lat: 38.7,
  lon: -9.1,
};

function itinerary(placeIds: (string | null)[]): Itinerary {
  return {
    destination: "Lisbon",
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
        items: placeIds.map((placeId, i) => ({
          time: `1${i}:00`,
          type: "activity" as const,
          title: `Item ${i}`,
          placeId,
          placeName: null,
          durationMinutes: null,
          estimatedCostPerPerson: null,
          whyItFits: "",
          notes: null,
        })),
      },
    ],
  };
}

function fakeClient(output: unknown, stopReason = "end_turn") {
  const parse = vi.fn().mockResolvedValue({
    stop_reason: stopReason,
    parsed_output: output,
    usage: { input_tokens: 1000, output_tokens: 500 },
  });
  return { client: { messages: { parse } } as unknown as Anthropic, parse };
}

beforeEach(() => {
  vi.mocked(cached.cachedGeocode).mockResolvedValue({
    name: "Lisboa",
    displayName: "Lisboa, Portugal",
    lat: 38.7,
    lon: -9.1,
    countryCode: "PT",
  });
  vi.mocked(cached.cachedWeather).mockResolvedValue({
    source: "unavailable",
    days: [],
    note: "n/a",
  });
  vi.mocked(cached.cachedSearchPlaces).mockResolvedValue([museum]);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("planTrip", () => {
  it("makes one model call with the candidates and keeps only real places", async () => {
    const { client, parse } = fakeClient(itinerary(["osm:node/1", "osm:node/999", null]));
    const result = await planTrip(trip, client);

    expect(parse).toHaveBeenCalledOnce();
    const prompt = parse.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("osm:node/1 | Real Museum | museums");

    const [real, invented, generic] = result.itinerary.days[0].items;
    expect(real.placeName).toBe("Real Museum");
    expect(invented.placeId).toBeNull();
    expect(generic.placeId).toBeNull();
    expect(result.places).toEqual({ "osm:node/1": museum });
    expect(result.warnings).toHaveLength(1);
    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 500 });
  });

  it("still plans when place search fails, with a warning", async () => {
    vi.mocked(cached.cachedSearchPlaces).mockRejectedValue(new Error("Overpass down"));
    const { client, parse } = fakeClient(itinerary([null]));
    const result = await planTrip(trip, client);
    expect(parse.mock.calls[0][0].messages[0].content).toContain("none available");
    expect(result.warnings[0]).toContain("Place data was unavailable");
  });

  it("fails clearly when the destination can't be found", async () => {
    vi.mocked(cached.cachedGeocode).mockResolvedValue(null);
    const { client, parse } = fakeClient(itinerary([]));
    await expect(planTrip(trip, client)).rejects.toThrow(PlannerError);
    expect(parse).not.toHaveBeenCalled();
  });

  it("rejects truncated output", async () => {
    const { client } = fakeClient(null, "max_tokens");
    await expect(planTrip(trip, client)).rejects.toThrow("too long");
  });
});

describe("categoriesFor", () => {
  it("always includes basics and adds interest categories without duplicates", () => {
    expect(categoriesFor(["History", "art", "unknown"])).toEqual([
      "sights",
      "restaurants",
      "cafes",
      "museums",
      "worship",
    ]);
  });
});

describe("describePlaces", () => {
  it("lists details compactly", () => {
    expect(
      describePlaces([{ ...museum, openingHours: "Tu-Su 10:00-18:00", diet: ["vegan"] }]),
    ).toContain(
      "osm:node/1 | Real Museum | museums | 38.7000,-9.1000 | hours=Tu-Su 10:00-18:00; diet=vegan",
    );
  });
});
