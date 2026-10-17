import { describe, expect, it } from "vitest";
import { makeDay, makeItem, makeItinerary } from "@/test/fixtures";
import { ItinerarySchema, TripRequestSchema, tripLengthDays } from "./trip";

const validTrip = {
  destination: "Lisbon",
  startDate: "2026-11-01",
  endDate: "2026-11-03",
  travelers: { adults: 2 },
};

describe("TripRequestSchema", () => {
  it("accepts a minimal trip and fills defaults", () => {
    const trip = TripRequestSchema.parse(validTrip);
    expect(trip.pace).toBe("balanced");
    expect(trip.travelers.children).toBe(0);
    expect(trip.interests).toEqual([]);
  });

  it("uppercases the budget currency", () => {
    const trip = TripRequestSchema.parse({
      ...validTrip,
      budget: { amount: 900, currency: "eur" },
    });
    expect(trip.budget).toEqual({ amount: 900, currency: "EUR", per: "trip" });
  });

  it("rejects an end date before the start date", () => {
    const result = TripRequestSchema.safeParse({ ...validTrip, endDate: "2026-10-30" });
    expect(result.success).toBe(false);
  });

  it("rejects trips longer than 14 days", () => {
    const result = TripRequestSchema.safeParse({ ...validTrip, endDate: "2026-11-15" });
    expect(result.success).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(TripRequestSchema.safeParse({ ...validTrip, startDate: "Nov 1" }).success).toBe(false);
  });
});

describe("tripLengthDays", () => {
  it("counts both ends inclusively", () => {
    expect(tripLengthDays("2026-11-01", "2026-11-01")).toBe(1);
    expect(tripLengthDays("2026-11-01", "2026-11-03")).toBe(3);
  });

  it("is not thrown off by DST changes", () => {
    expect(tripLengthDays("2026-03-28", "2026-03-30")).toBe(3);
  });
});

describe("ItinerarySchema", () => {
  it("parses a well-formed itinerary", () => {
    const itinerary = makeItinerary([
      makeDay(1, [makeItem({ type: "meal", title: "Breakfast", estimatedCostPerPerson: 8 })]),
    ]);
    expect(ItinerarySchema.safeParse(itinerary).success).toBe(true);
  });

  it("requires the stay, packing list, and essentials sections", () => {
    const withoutStay: Partial<ReturnType<typeof makeItinerary>> = makeItinerary([]);
    delete withoutStay.stay;
    expect(ItinerarySchema.safeParse(withoutStay).success).toBe(false);
  });
});

describe("TripRequestSchema extras", () => {
  it("accepts origin, passport, and capped feedback", () => {
    const trip = TripRequestSchema.parse({
      ...validTrip,
      origin: "Delhi",
      passportCountry: "India",
      feedback: { liked: ["Tapas bars"] },
    });
    expect(trip.feedback).toEqual({ liked: ["Tapas bars"], disliked: [] });
    const tooMany = { liked: Array.from({ length: 11 }, (_, i) => `x${i}`) };
    expect(TripRequestSchema.safeParse({ ...validTrip, feedback: tooMany }).success).toBe(false);
  });
});
