import { cacheLife } from "next/cache";
import { geocode } from "./geocode";
import { searchPlaces, type PlaceCategory } from "./places";
import { getWeather } from "./weather";

// Cached wrappers around the free data APIs. Public Overpass servers are slow
// and rate-limited, so repeat lookups for the same city should never hit them.
// The plain functions stay uncached so they can be unit-tested outside Next.js.

/** ~110 m precision: nearby searches from the model share a cache entry. */
export function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export async function cachedGeocode(query: string) {
  "use cache";
  cacheLife("weeks");
  return geocode(query.trim().toLowerCase());
}

export async function cachedSearchPlaces(
  category: PlaceCategory,
  lat: number,
  lon: number,
  radiusMeters: number,
) {
  "use cache";
  cacheLife("days");
  return searchPlaces(category, roundCoord(lat), roundCoord(lon), radiusMeters);
}

export async function cachedWeather(lat: number, lon: number, startDate: string, endDate: string) {
  "use cache";
  cacheLife("hours");
  return getWeather(roundCoord(lat), roundCoord(lon), startDate, endDate);
}
