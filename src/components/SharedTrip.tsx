"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { decodeTrip, type SharedTrip as SharedTripData } from "@/lib/share";
import { saveTrip } from "@/lib/storage";
import { ItineraryView } from "./ItineraryView";
import {
  BudgetPanel,
  EssentialsPanel,
  GettingAroundPanel,
  PackingPanel,
  StayPanel,
  TipsPanel,
} from "./TripExtras";
import { SmallButton } from "./ui";

type State =
  { status: "loading" } | { status: "invalid" } | { status: "ready"; data: SharedTripData };

export function SharedTrip() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hash = window.location.hash.slice(1);
    const load = hash ? decodeTrip(hash) : Promise.resolve(null);
    load.then((data) => {
      if (!cancelled) setState(data ? { status: "ready", data } : { status: "invalid" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <div className="h-96 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />;
  }
  if (state.status === "invalid") {
    return (
      <div className="space-y-4">
        <p>
          This share link is incomplete or broken. Ask for the link again, or plan your own trip.
        </p>
        <Link href="/" className="underline underline-offset-4">
          Plan a trip
        </Link>
      </div>
    );
  }

  const { trip, result } = state.data;
  const { itinerary } = result;
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">Shared itinerary</p>
        <h1 className="text-3xl font-semibold">{itinerary.destination}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">{itinerary.summary}</p>
        <p className="text-sm text-zinc-500">
          {trip.startDate} to {trip.endDate}
        </p>
      </header>

      <div className="flex flex-wrap gap-2 print:hidden">
        <SmallButton
          disabled={saved}
          onClick={() =>
            setSaved(
              Boolean(
                saveTrip(trip, {
                  ...result,
                  warnings: [],
                  model: "",
                  usage: { inputTokens: 0, outputTokens: 0 },
                }),
              ),
            )
          }
        >
          {saved ? "Saved to My trips" : "Save to my trips"}
        </SmallButton>
        <SmallButton onClick={() => window.print()}>Print / PDF</SmallButton>
        <Link
          href="/"
          className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Plan your own trip
        </Link>
      </div>

      <ItineraryView result={result} />

      <div className="grid gap-6 md:grid-cols-2">
        <StayPanel itinerary={itinerary} trip={trip} />
        <GettingAroundPanel itinerary={itinerary} trip={trip} />
        <BudgetPanel itinerary={itinerary} trip={trip} />
        <EssentialsPanel itinerary={itinerary} />
        <PackingPanel items={itinerary.packingList} />
        <TipsPanel tips={itinerary.tips} />
      </div>
    </section>
  );
}
