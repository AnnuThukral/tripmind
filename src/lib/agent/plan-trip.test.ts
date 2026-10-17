import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TripRequestSchema, type Itinerary } from "@/lib/schema/trip";
import { makeDay, makeItem, makeItinerary } from "@/test/fixtures";
import { suggestDestinations } from "./ideas";
import { MODEL } from "./model";
import { categoriesFor, describePlaces, planTrip, PlannerError } from "./planner";
import { mergeDays, reviseItinerary } from "./revise";

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
  return makeItinerary([
    makeDay(
      1,
      placeIds.map((placeId, i) => makeItem({ time: `1${i}:00`, title: `Item ${i}`, placeId })),
    ),
  ]);
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

describe("every AI call", () => {
  it("uses the pinned Haiku model", async () => {
    const { client, parse } = fakeClient(itinerary([]));
    await planTrip(trip, client);
    expect(parse.mock.calls[0][0].model).toBe(MODEL);
  });
});

describe("reviseItinerary", () => {
  const twoDays = makeItinerary([
    makeDay(1, [makeItem({ title: "Old day 1" })]),
    makeDay(2, [makeItem({ title: "Old day 2" })]),
  ]);

  it("replaces only the changed days, keeps dates, and grounds new places", async () => {
    const changed = {
      ...makeDay(2, [
        makeItem({ title: "New museum", placeId: "osm:node/1" }),
        makeItem({ title: "Invented", placeId: "osm:node/404" }),
      ]),
      date: "2099-01-01",
    };
    const { client, parse } = fakeClient({ days: [changed], note: "Swapped day 2." });
    const result = await reviseItinerary(
      { trip, itinerary: twoDays, instruction: "Make day 2 about museums" },
      client,
    );

    expect(parse.mock.calls[0][0].model).toBe(MODEL);
    expect(parse.mock.calls[0][0].messages[0].content).toContain("Make day 2 about museums");
    expect(result.changedDays).toEqual([2]);
    expect(result.itinerary.days[0].items[0].title).toBe("Old day 1");
    expect(result.itinerary.days[1].date).toBe("2026-11-02");
    expect(result.itinerary.days[1].items.map((i) => i.placeId)).toEqual(["osm:node/1", null]);
    expect(result.places).toEqual({ "osm:node/1": museum });
    expect(result.note).toBe("Swapped day 2.");
  });

  it("rejects edits that touch no existing day", async () => {
    const { client } = fakeClient({ days: [makeDay(9)], note: "" });
    await expect(
      reviseItinerary({ trip, itinerary: twoDays, instruction: "x x x" }, client),
    ).rejects.toThrow(PlannerError);
  });

  it("mergeDays ignores unknown day numbers", () => {
    const merged = mergeDays(twoDays, [makeDay(5, [makeItem({ title: "nope" })])]);
    expect(merged.days).toEqual(twoDays.days);
  });
});

describe("suggestDestinations", () => {
  it("returns at most 4 ideas from one Haiku call", async () => {
    const idea = {
      destination: "Porto, Portugal",
      why: "",
      highlights: [],
      weatherInMonth: "",
      typicalDailyCostUsd: 90,
      gettingThere: null,
      watchOut: null,
    };
    const { client, parse } = fakeClient({ ideas: [idea, idea, idea, idea, idea] });
    const result = await suggestDestinations(
      { month: "2026-11", tripDays: 4, vibes: ["food"], budgetLevel: "mid-range" },
      client,
    );
    expect(parse).toHaveBeenCalledOnce();
    expect(parse.mock.calls[0][0].model).toBe(MODEL);
    expect(parse.mock.calls[0][0].messages[0].content).toContain("November 2026");
    expect(result.ideas).toHaveLength(4);
  });
});
