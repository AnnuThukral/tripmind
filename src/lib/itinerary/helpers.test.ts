import { describe, expect, it } from "vitest";
import type { PlanResult } from "@/lib/agent/planner";
import { TripRequestSchema } from "@/lib/schema/trip";
import { decodeTrip, encodeTrip } from "@/lib/share";
import { makeDay, makeItem, makeItinerary } from "@/test/fixtures";
import { budgetBreakdown } from "./budget";
import { itineraryToIcs } from "./ics";
import { bookingLinks, checkoutDate, dayDirectionsUrl } from "./links";

const trip = TripRequestSchema.parse({
  destination: "Lisbon",
  startDate: "2026-11-01",
  endDate: "2026-11-03",
  travelers: { adults: 2, children: 1 },
  budget: { amount: 900, currency: "EUR" },
});

describe("bookingLinks", () => {
  it("pre-fills stay and activity searches", () => {
    const links = bookingLinks(trip, "Baixa");
    const booking = new URL(links.find((l) => l.label === "Booking.com")!.href);
    expect(booking.searchParams.get("ss")).toBe("Baixa, Lisbon");
    expect(booking.searchParams.get("checkin")).toBe("2026-11-01");
    expect(booking.searchParams.get("checkout")).toBe("2026-11-03");
    expect(booking.searchParams.get("group_children")).toBe("1");
    expect(links.some((l) => l.kind === "transport")).toBe(false);
  });

  it("adds transport links when an origin is known", () => {
    const links = bookingLinks({ ...trip, origin: "Delhi" });
    const flights = links.find((l) => l.label === "Google Flights")!;
    expect(new URL(flights.href).searchParams.get("q")).toContain("from Delhi to Lisbon");
  });

  it("checks out the next day for one-day trips", () => {
    expect(checkoutDate({ startDate: "2026-11-01", endDate: "2026-11-01" })).toBe("2026-11-02");
  });
});

describe("dayDirectionsUrl", () => {
  const stop = (n: number) => ({ itemIndex: n, order: n, name: "", time: "", lat: n, lon: n });

  it("routes through the stops in order", () => {
    const url = new URL(dayDirectionsUrl([stop(1), stop(2), stop(3)])!);
    expect(url.searchParams.get("origin")).toBe("1,1");
    expect(url.searchParams.get("waypoints")).toBe("2,2");
    expect(url.searchParams.get("destination")).toBe("3,3");
  });

  it("needs at least two stops", () => {
    expect(dayDirectionsUrl([stop(1)])).toBeNull();
  });
});

describe("budgetBreakdown", () => {
  it("totals by type for the group and compares with the budget", () => {
    const itinerary = makeItinerary(
      [
        makeDay(1, [
          makeItem({ type: "meal", estimatedCostPerPerson: 20 }),
          makeItem({ type: "activity", estimatedCostPerPerson: 10 }),
          makeItem({ type: "transport", estimatedCostPerPerson: 5 }),
          makeItem({ type: "rest", estimatedCostPerPerson: null }),
        ]),
      ],
      {
        stay: { area: "", why: "", alternatives: [], estimatedNightlyCost: 100 },
      },
    );
    const b = budgetBreakdown(itinerary, trip);
    expect(b.perPerson).toEqual({ food: 20, activities: 10, transport: 5 });
    expect(b.nights).toBe(2);
    expect(b.stay).toBe(200);
    expect(b.groupTotal).toBe(35 * 3 + 200);
    expect(b.overBudgetBy).toBe(0);
  });

  it("can't compare budgets in different currencies", () => {
    const b = budgetBreakdown(makeItinerary([], { currency: "USD" }), trip);
    expect(b.overBudgetBy).toBeNull();
  });
});

describe("itineraryToIcs", () => {
  it("creates one escaped event per timed item", () => {
    const ics = itineraryToIcs(
      makeItinerary([
        makeDay(1, [
          makeItem({ time: "09:30", title: "Coffee, pastries", durationMinutes: 45 }),
          makeItem({ time: "evening", title: "Untimed" }),
        ]),
      ]),
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("DTSTART:20261101T093000");
    expect(ics).toContain("DTEND:20261101T101500");
    expect(ics).toContain("SUMMARY:Coffee\\, pastries");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("share links", () => {
  it("round-trips a trip through the URL encoding", async () => {
    const result: PlanResult = {
      itinerary: makeItinerary([makeDay(1, [makeItem({ title: "Café ☕ São Jorge" })])]),
      places: {},
      warnings: ["not shared"],
      model: "x",
      usage: { inputTokens: 1, outputTokens: 1 },
    };
    const encoded = await encodeTrip(trip, result);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const decoded = await decodeTrip(encoded);
    expect(decoded?.trip).toEqual(trip);
    expect(decoded?.result.itinerary.days[0].items[0].title).toBe("Café ☕ São Jorge");
    expect(decoded?.result).not.toHaveProperty("warnings");
  });

  it("returns null for garbage", async () => {
    expect(await decodeTrip("not-a-trip")).toBeNull();
  });
});
