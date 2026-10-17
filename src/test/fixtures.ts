import type { Itinerary, ItineraryDay, ItineraryItem } from "@/lib/schema/trip";

export function makeItem(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    time: "10:00",
    type: "activity",
    title: "Item",
    placeId: null,
    placeName: null,
    durationMinutes: null,
    estimatedCostPerPerson: null,
    whyItFits: "",
    notes: null,
    ...overrides,
  };
}

export function makeDay(day: number, items: ItineraryItem[] = []): ItineraryDay {
  return {
    day,
    date: `2026-11-${String(day).padStart(2, "0")}`,
    theme: `Theme ${day}`,
    area: `Area ${day}`,
    weatherNote: null,
    items,
  };
}

export function makeItinerary(days: ItineraryDay[], overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    destination: "Lisbon",
    summary: "",
    currency: "EUR",
    days,
    estimatedTotalPerPerson: null,
    tips: [],
    stay: { area: "Baixa", why: "Central", alternatives: [], estimatedNightlyCost: null },
    packingList: [],
    essentials: {
      entryRequirements: "",
      currency: "",
      language: "",
      plugs: "",
      emergencyNumber: "112",
      gettingAround: "",
      safety: "",
    },
    ...overrides,
  };
}
