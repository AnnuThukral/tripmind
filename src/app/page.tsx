import { Suspense } from "react";
import { TripForm } from "@/components/TripForm";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:py-20">
      <header className="mb-10 space-y-3">
        <p className="text-sm font-medium tracking-wide text-sky-600 uppercase">TripMind</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Your trip, planned around you.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Tell us where, when, and what you love. TripMind builds a day-by-day itinerary from real
          places, live weather, and your pace.
        </p>
      </header>
      {/* The form defaults its dates to next week, so it can't be prerendered. */}
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />}
      >
        <TripForm />
      </Suspense>
    </main>
  );
}
