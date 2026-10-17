import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About and privacy | TripMind",
  description: "How TripMind works, what data it uses, and its limits.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-12 sm:py-16">
      <header className="space-y-2">
        <Link
          href="/"
          className="text-sm text-sky-700 underline underline-offset-4 dark:text-sky-400"
        >
          ← Back to TripMind
        </Link>
        <h1 className="text-3xl font-semibold">About and privacy</h1>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">How it works</h2>
        <p>
          TripMind looks up your destination, the weather forecast, and real named places nearby
          from free, open data sources, then asks an AI model (Claude Haiku, by Anthropic) to
          arrange them into a day-by-day plan. Any place the AI mentions that wasn&apos;t in the
          real list is removed from the links and map.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Your data</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            There are no accounts. Saved trips, your preferences, and your 👍/👎 are stored only in
            your own browser.
          </li>
          <li>
            When you plan or edit a trip, your trip details are sent to our server and to
            Anthropic&apos;s API to generate the plan. We don&apos;t store them on our server.
          </li>
          <li>
            Share links contain the whole trip inside the link itself. Anyone you send the link to
            can see that trip.
          </li>
          <li>
            To count daily free usage, we briefly keep a counter keyed by your IP address, which
            expires after a day.
          </li>
        </ul>
        <ClearDataNote />
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Limits and disclaimers</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Plans are AI-generated suggestions. Check opening hours, prices, and bookings yourself.
          </li>
          <li>
            Visa, entry, health, and safety notes are general guidance only. Always confirm with
            official government or embassy websites before you travel.
          </li>
          <li>
            Booking links open other sites with your search pre-filled. TripMind doesn&apos;t sell
            anything.
          </li>
          <li>
            To keep TripMind free, there are small daily limits on plans, edits, and destination
            ideas.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Credits</h2>
        <p>
          Map data © OpenStreetMap contributors. Weather by Open-Meteo. Plans by Claude (Anthropic).
          Source code on{" "}
          <a
            href="https://github.com/AnnuThukral/tripmind"
            className="underline underline-offset-4"
          >
            GitHub
          </a>
          .
        </p>
      </section>
    </main>
  );
}

function ClearDataNote() {
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      To delete everything TripMind saved, clear this site&apos;s data in your browser settings, or
      delete trips one by one from My trips.
    </p>
  );
}
