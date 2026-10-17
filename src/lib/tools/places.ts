import { fetchJson, USER_AGENT } from "./http";

export const PLACE_CATEGORIES = {
  sights: [
    'tourism~"^(attraction|viewpoint|artwork)$"',
    'historic~"^(monument|castle|memorial|ruins|archaeological_site)$"',
  ],
  museums: ['tourism~"^(museum|gallery)$"'],
  nature: ['leisure~"^(park|garden|nature_reserve)$"', 'natural~"^(beach|peak)$"'],
  restaurants: ["amenity=restaurant"],
  cafes: ['amenity~"^(cafe|ice_cream)$"'],
  street_food: ['amenity~"^(fast_food|food_court)$"', "amenity=marketplace"],
  nightlife: ['amenity~"^(bar|pub|nightclub)$"'],
  shopping: ['shop~"^(mall|department_store|gift|books|clothes)$"', "amenity=marketplace"],
  worship: ["amenity=place_of_worship", 'building~"^(church|cathedral|temple|mosque)$"'],
} as const;

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

export function buildOverpassQuery(
  category: PlaceCategory,
  lat: number,
  lon: number,
  radiusMeters: number,
  limit: number,
): string {
  const around = `(around:${radiusMeters},${lat},${lon})`;
  const selectors = PLACE_CATEGORIES[category].map((f) => `nwr[${f}]["name"]${around};`).join("");
  return `[out:json][timeout:25];(${selectors});out center tags ${limit};`;
}

export function toPlace(el: OverpassElement, category: PlaceCategory): Place | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!tags.name || lat === undefined || lon === undefined) return null;
  const diet = Object.entries(tags)
    .filter(([k, v]) => k.startsWith("diet:") && (v === "yes" || v === "only"))
    .map(([k]) => k.slice(5));
  return {
    id: `osm:${el.type}/${el.id}`,
    name: tags["name:en"] ?? tags.name,
    category,
    lat,
    lon,
    ...(tags.cuisine && { cuisine: tags.cuisine }),
    ...(tags.opening_hours && { openingHours: tags.opening_hours }),
    ...((tags.website ?? tags["contact:website"]) && {
      website: tags.website ?? tags["contact:website"],
    }),
    ...(diet.length > 0 && { diet }),
  };
}

// Public Overpass instances are often at capacity; fall through to the next one.
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
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
        35_000,
      );
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Real, named places near a point from OpenStreetMap (Overpass API, free). */
export async function searchPlaces(
  category: PlaceCategory,
  lat: number,
  lon: number,
  radiusMeters = 3000,
  limit = 25,
): Promise<Place[]> {
  const json = await queryOverpass(buildOverpassQuery(category, lat, lon, radiusMeters, limit * 2));
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const el of json.elements) {
    const place = toPlace(el, category);
    if (!place || seen.has(place.name)) continue;
    seen.add(place.name);
    places.push(place);
    if (places.length >= limit) break;
  }
  return places;
}
