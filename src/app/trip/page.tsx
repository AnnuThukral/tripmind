import type { Metadata } from "next";
import { SharedTripClient } from "@/components/SharedTripClient";

export const metadata: Metadata = {
  title: "Shared trip | TripMind",
  description: "A day-by-day itinerary planned with TripMind.",
  robots: { index: false },
};

export default function SharedTripPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:py-16">
      <SharedTripClient />
    </main>
  );
}
