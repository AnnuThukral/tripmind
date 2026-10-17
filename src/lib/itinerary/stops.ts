import type { ItineraryDay } from "@/lib/schema/trip";
import type { Place } from "@/lib/tools/places";

export interface MapStop {
  /** Index of the itinerary item this stop belongs to. */
  itemIndex: number;
  order: number;
  name: string;
  time: string;
  lat: number;
  lon: number;
}

/** Map stops for a day's verified places, numbered in visiting order. */
export function dayStops(day: ItineraryDay, places: Record<string, Place>): MapStop[] {
  const stops: MapStop[] = [];
  for (const [itemIndex, item] of day.items.entries()) {
    const place = item.placeId ? places[item.placeId] : undefined;
    if (place) {
      stops.push({
        itemIndex,
        order: stops.length + 1,
        name: place.name,
        time: item.time,
        lat: place.lat,
        lon: place.lon,
      });
    }
  }
  return stops;
}
