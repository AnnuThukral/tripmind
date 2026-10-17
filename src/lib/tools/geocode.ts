import { fetchJson } from "./http";

export interface GeoResult {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  countryCode: string | null;
}

interface NominatimHit {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: { country_code?: string };
}

/** Resolve a free-text place name to coordinates via OpenStreetMap Nominatim. */
export async function geocode(query: string): Promise<GeoResult | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({ q: query, format: "jsonv2", limit: "1", addressdetails: "1" });
  const hits = await fetchJson<NominatimHit[]>("Nominatim", url);
  const hit = hits[0];
  if (!hit) return null;
  return {
    name: hit.name || query,
    displayName: hit.display_name,
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    countryCode: hit.address?.country_code?.toUpperCase() ?? null,
  };
}
