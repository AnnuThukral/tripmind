import type { TripRequest } from "@/lib/schema/trip";
import type { MapStop } from "./stops";

export interface BookingLink {
  label: string;
  href: string;
  kind: "stay" | "transport" | "activities";
}

/** Checkout is the last trip day, or the next day for a one-day trip. */
export function checkoutDate(trip: Pick<TripRequest, "startDate" | "endDate">): string {
  if (trip.endDate > trip.startDate) return trip.endDate;
  const d = new Date(`${trip.startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Pre-filled search links on popular booking sites. No API keys or affiliate
 * IDs; those can be added here later without touching the UI.
 */
export function bookingLinks(trip: TripRequest, stayArea?: string): BookingLink[] {
  const where = stayArea ? `${stayArea}, ${trip.destination}` : trip.destination;
  const checkout = checkoutDate(trip);
  const { adults, children } = trip.travelers;
  const links: BookingLink[] = [
    {
      kind: "stay",
      label: "Booking.com",
      href:
        "https://www.booking.com/searchresults.html?" +
        new URLSearchParams({
          ss: where,
          checkin: trip.startDate,
          checkout,
          group_adults: String(adults),
          group_children: String(children),
          no_rooms: "1",
        }),
    },
    {
      kind: "stay",
      label: "Airbnb",
      href:
        `https://www.airbnb.com/s/${encodeURIComponent(where)}/homes?` +
        new URLSearchParams({
          checkin: trip.startDate,
          checkout,
          adults: String(adults),
          children: String(children),
        }),
    },
    {
      kind: "activities",
      label: "GetYourGuide",
      href:
        "https://www.getyourguide.com/s/?" +
        new URLSearchParams({
          q: trip.destination,
          date_from: trip.startDate,
          date_to: trip.endDate,
        }),
    },
  ];
  if (trip.origin) {
    links.push(
      {
        kind: "transport",
        label: "Google Flights",
        href:
          "https://www.google.com/travel/flights?" +
          new URLSearchParams({
            q: `Flights from ${trip.origin} to ${trip.destination} on ${trip.startDate} returning ${trip.endDate}`,
          }),
      },
      {
        kind: "transport",
        label: "Rome2Rio (trains, buses, ferries)",
        href: `https://www.rome2rio.com/map/${encodeURIComponent(trip.origin)}/${encodeURIComponent(trip.destination)}`,
      },
    );
  }
  return links;
}

/** Google Maps walking directions through a day's stops (max 9 waypoints). */
export function dayDirectionsUrl(stops: readonly MapStop[]): string | null {
  if (stops.length < 2) return null;
  const point = (s: MapStop) => `${s.lat},${s.lon}`;
  const first = stops[0];
  const last = stops[stops.length - 1];
  const waypoints = stops.slice(1, -1).slice(0, 9).map(point).join("|");
  return (
    "https://www.google.com/maps/dir/?" +
    new URLSearchParams({
      api: "1",
      origin: point(first),
      destination: point(last),
      ...(waypoints && { waypoints }),
      travelmode: "walking",
    })
  );
}
