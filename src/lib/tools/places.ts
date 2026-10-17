import { fetchJson, USER_AGENT } from "./http";

/** Each category is a list of OSM tag filters: key plus allowed values. */
export const PLACE_CATEGORIES = {
  sights: [
    { key: "tourism", values: ["attraction", "viewpoint", "artwork"] },
    { key: "historic", values: ["monument", "castle", "memorial", "ruins", "archaeological_site"] },
  ],
  museums: [{ key: "tourism", values: ["museum", "gallery"] }],
  nature: [
    { key: "leisure", values: ["park", "garden", "nature_reserve"] },
    { key: "natural", values: ["beach", "peak"] },
  ],
  restaurants: [{ key: "amenity", values: ["restaurant"] }],
  cafes: [{ key: "amenity", values: ["cafe", "ice_cream"] }],
  street_food: [{ key: "amenity", values: ["fast_food", "food_court", "marketplace"] }],
  nightlife: [{ key: "amenity", values: ["bar", "pub", "nightclub"] }],
  shopping: [
    { key: "shop", values: ["mall", "department_store", "gift", "books", "clothes"] },
    { key: "amenity", values: ["marketplace"] },
  ],
  worship: [{ key: "amenity", values: ["place_of_worship"] }],
} as const satisfies Record<string, readonly { key: string; values: readonly string[] }[]>;

export type PlaceCategory = keyof typeof PLACE_CATEGORIES;

export interface Place {
  /** Stable OpenStreetMap reference, e.g. "osm:node/123". */
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lon: number;
  cuisine?: string;
  openingHours?: string;
  website?: string;
  diet?: string[];
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * One Overpass request for several categories. Each category gets its own
 * output statement and limit, so dense categories (restaurants) can't crowd
 * out sparse ones (museums).
 */
export function buildOverpassQuery(
  categories: readonly PlaceCategory[],
  lat: number,
  lon: number,
  radiusMeters: number,
  perCategory: number,
): string {
  const around = `(around:${radiusMeters},${lat},${lon})`;
  const blocks = categories.map((category) => {
    const selectors = PLACE_CATEGORIES[category]
      .map(({ key, values }) => `nwr["${key}"~"^(${values.join("|")})$"]["name"]${around};`)
      .join("");
    return `(${selectors});out center tags ${perCategory};`;
  });
  return `[out:json][timeout:25];${blocks.join("")}`;
}

/** First requested category whose filters match the element's tags. */
export function categorize(
  tags: Record<string, string>,
  categories: readonly PlaceCategory[],
): PlaceCategory | null {
  for (const category of categories) {
    const matches = PLACE_CATEGORIES[category].some(({ key, values }) =>
      (values as readonly string[]).includes(tags[key]),
    );
    if (matches) return category;
  }
  return null;
}

export function toPlace(el: OverpassElement, category: PlaceCategory): Place | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!tags.name || lat === undefined || lon === undefined) return null;
  const diet = Object.entries(tags)
    .filter(([k, v]) => k.startsWith("diet:") && (v === "yes" || v === "only"))
    .map(([k]) => k.slice(5));
  const website = tags.website ?? tags["contact:website"];
  return {
    id: `osm:${el.type}/${el.id}`,
    name: tags["name:en"] ?? tags.name,
    category,
    lat,
    lon,
    ...(tags.cuisine && { cuisine: tags.cuisine }),
    ...(tags.opening_hours && { openingHours: tags.opening_hours }),
    ...(website && { website }),
    ...(diet.length > 0 && { diet }),
  };
}

// Public Overpass instances are often at capacity; fall through to the next one.
// Failing instances usually answer within a second, so the timeout only bites
// on an instance that accepted the query but is slow.
// Ordered by observed speed for city-sized queries (mail.ru ~14s vs ~39s, Oct 2026).
export const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function queryOverpass(query: string): Promise<{ elements: OverpassElement[] }> {
  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      return await fetchJson<{ elements: OverpassElement[] }>(
        "Overpass",
        endpoint,
        {
          method: "POST",
          body: new URLSearchParams({ data: query }),
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
        40_000,
      );
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Real, named places near a point from OpenStreetMap (Overpass API, free),
 * de-duplicated by name and capped per category.
 */
export async function searchPlaces(
  categories: readonly PlaceCategory[],
  lat: number,
  lon: number,
  radiusMeters = 4000,
  perCategory = 15,
): Promise<Place[]> {
  // Ask for extra per category: unnamed-in-English duplicates get dropped below.
  const json = await queryOverpass(
    buildOverpassQuery(categories, lat, lon, radiusMeters, perCategory * 2),
  );
  const seen = new Set<string>();
  const counts = new Map<PlaceCategory, number>();
  const places: Place[] = [];
  for (const el of json.elements) {
    const category = categorize(el.tags ?? {}, categories);
    if (!category || (counts.get(category) ?? 0) >= perCategory) continue;
    const place = toPlace(el, category);
    if (!place || seen.has(place.name)) continue;
    seen.add(place.name);
    counts.set(category, (counts.get(category) ?? 0) + 1);
    places.push(place);
  }
  return places;
}
