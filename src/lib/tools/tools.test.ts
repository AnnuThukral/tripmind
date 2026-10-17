import { afterEach, describe, expect, it, vi } from "vitest";
import { geocode } from "./geocode";
import { UpstreamError } from "./http";
import {
  buildOverpassQuery,
  categorize,
  OVERPASS_ENDPOINTS,
  searchPlaces,
  toPlace,
} from "./places";
import { describeWeatherCode, getWeather } from "./weather";

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("geocode", () => {
  it("maps the first Nominatim hit", async () => {
    mockFetch([
      {
        name: "Lisboa",
        display_name: "Lisboa, Portugal",
        lat: "38.7",
        lon: "-9.1",
        address: { country_code: "pt" },
      },
    ]);
    expect(await geocode("Lisbon")).toEqual({
      name: "Lisboa",
      displayName: "Lisboa, Portugal",
      lat: 38.7,
      lon: -9.1,
      countryCode: "PT",
    });
  });

  it("returns null when nothing matches", async () => {
    mockFetch([]);
    expect(await geocode("nowhere-xyz")).toBeNull();
  });

  it("wraps HTTP failures in UpstreamError", async () => {
    mockFetch({}, 503);
    await expect(geocode("Lisbon")).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe("weather", () => {
  const today = new Date("2026-11-01T12:00:00Z");

  it("skips the API for dates beyond the forecast window", async () => {
    const fetchFn = mockFetch({});
    const report = await getWeather(38.7, -9.1, "2027-01-10", "2027-01-12", today);
    expect(report.source).toBe("unavailable");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("maps daily forecast arrays", async () => {
    mockFetch({
      daily: {
        time: ["2026-11-03"],
        temperature_2m_max: [19],
        temperature_2m_min: [12],
        precipitation_probability_max: [70],
        weather_code: [63],
      },
    });
    const report = await getWeather(38.7, -9.1, "2026-11-03", "2026-11-03", today);
    expect(report.days).toEqual([
      {
        date: "2026-11-03",
        tempMaxC: 19,
        tempMinC: 12,
        precipitationProbability: 70,
        summary: "rain",
      },
    ]);
  });

  it("describes WMO codes", () => {
    expect(describeWeatherCode(0)).toBe("clear");
    expect(describeWeatherCode(95)).toBe("thunderstorm");
  });
});

describe("places", () => {
  it("builds one query with a separately limited output per category", () => {
    const q = buildOverpassQuery(["museums", "cafes"], 1, 2, 1000, 10);
    expect(q).toBe(
      "[out:json][timeout:25];" +
        '(nwr["tourism"~"^(museum|gallery)$"]["name"](around:1000,1,2););out center tags 10;' +
        '(nwr["amenity"~"^(cafe|ice_cream)$"]["name"](around:1000,1,2););out center tags 10;',
    );
  });

  it("categorizes by the first requested category that matches", () => {
    expect(categorize({ amenity: "marketplace" }, ["street_food", "shopping"])).toBe("street_food");
    expect(categorize({ amenity: "marketplace" }, ["shopping", "street_food"])).toBe("shopping");
    expect(categorize({ amenity: "bank" }, ["shopping"])).toBeNull();
  });

  it("normalizes elements and reads diet tags", () => {
    const place = toPlace(
      {
        type: "way",
        id: 42,
        center: { lat: 1, lon: 2 },
        tags: {
          name: "Casa",
          "name:en": "House",
          "diet:vegan": "yes",
          "diet:halal": "no",
          cuisine: "portuguese",
        },
      },
      "restaurants",
    );
    expect(place).toEqual({
      id: "osm:way/42",
      name: "House",
      category: "restaurants",
      lat: 1,
      lon: 2,
      cuisine: "portuguese",
      diet: ["vegan"],
    });
  });

  it("falls back to the next Overpass mirror when one is at capacity", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("at capacity", { status: 502 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            elements: [
              { type: "node", id: 7, lat: 1, lon: 1, tags: { name: "C", amenity: "cafe" } },
            ],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchFn);
    const places = await searchPlaces(["cafes"], 1, 1);
    expect(places.map((p) => p.id)).toEqual(["osm:node/7"]);
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(OVERPASS_ENDPOINTS.slice(0, 2));
  });

  it("throws when every mirror fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => new Response("", { status: 504 })),
    );
    await expect(searchPlaces(["cafes"], 1, 1)).rejects.toBeInstanceOf(UpstreamError);
  });

  it("drops unnamed and uncategorized elements, de-duplicates, and caps per category", async () => {
    const cafe = (id: number, name?: string) => ({
      type: "node",
      id,
      lat: 1,
      lon: 1,
      tags: { amenity: "cafe", ...(name && { name }) },
    });
    mockFetch({
      elements: [
        cafe(1, "A"),
        cafe(2, "A"),
        cafe(3),
        { type: "node", id: 4, lat: 1, lon: 1, tags: { name: "Bank", amenity: "bank" } },
        cafe(5, "B"),
        cafe(6, "C"),
      ],
    });
    const places = await searchPlaces(["cafes"], 1, 1, 1000, 2);
    expect(places.map((p) => p.id)).toEqual(["osm:node/1", "osm:node/5"]);
  });
});
