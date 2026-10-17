import type { Itinerary, TripRequest } from "@/lib/schema/trip";
import { tripLengthDays } from "@/lib/schema/trip";

export interface BudgetBreakdown {
  currency: string;
  travelers: number;
  /** Per-person totals by item type, from the itinerary's cost estimates. */
  perPerson: { food: number; activities: number; transport: number };
  /** Rough stay cost for the whole group (one room), when the plan has a nightly rate. */
  stay: number | null;
  nights: number;
  /** Everything above for the whole group. */
  groupTotal: number;
  /** The traveler's budget for the whole trip, in their currency, if given. */
  budget: { amount: number; currency: string } | null;
  /** Only comparable when the budget is in the itinerary's currency. */
  overBudgetBy: number | null;
}

export function budgetBreakdown(itinerary: Itinerary, trip: TripRequest): BudgetBreakdown {
  const perPerson = { food: 0, activities: 0, transport: 0 };
  for (const day of itinerary.days) {
    for (const item of day.items) {
      const cost = item.estimatedCostPerPerson ?? 0;
      if (item.type === "meal") perPerson.food += cost;
      else if (item.type === "transport") perPerson.transport += cost;
      else perPerson.activities += cost;
    }
  }
  const travelers = trip.travelers.adults + trip.travelers.children;
  const nights = Math.max(tripLengthDays(trip.startDate, trip.endDate) - 1, 1);
  const nightly = itinerary.stay.estimatedNightlyCost;
  const stay = nightly !== null ? nightly * nights : null;
  const groupTotal =
    (perPerson.food + perPerson.activities + perPerson.transport) * travelers + (stay ?? 0);

  const budget = trip.budget
    ? {
        amount:
          trip.budget.per === "day"
            ? trip.budget.amount * tripLengthDays(trip.startDate, trip.endDate)
            : trip.budget.amount,
        currency: trip.budget.currency,
      }
    : null;
  const comparable = budget && budget.currency === itinerary.currency.toUpperCase();
  return {
    currency: itinerary.currency,
    travelers,
    perPerson,
    stay,
    nights,
    groupTotal,
    budget,
    overBudgetBy: comparable ? Math.max(groupTotal - budget.amount, 0) : null,
  };
}
