import Link from "next/link";
import { PlannerClient } from "@/components/PlannerClient";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:py-20">
      <header className="mb-10 space-y-3 print:mb-4">
        <p className="text-sm font-medium tracking-wide text-sky-600 uppercase">TripMind</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl print:hidden">
          Your trip, planned around you.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 print:hidden">
          Tell us where, when, and what you love, or let us suggest somewhere. TripMind builds a
          day-by-day itinerary from real places, live weather, and your pace.
        </p>
      </header>
      <PlannerClient />
      <footer className="mt-16 text-xs text-zinc-500 print:hidden">
        <Link href="/about" className="underline underline-offset-4">
          About and privacy
        </Link>
        {" · "}
        <a href="https://github.com/AnnuThukral/tripmind" className="underline underline-offset-4">
          Source on GitHub
        </a>
      </footer>
    </main>
  );
}
