"use client";

import dynamic from "next/dynamic";
import type { PlanResult } from "@/lib/agent/planner";
import { dayStops } from "@/lib/itinerary/stops";

// Leaflet touches `window` on import, so the map only loads in the browser.
const DayMap = dynamic(() => import("./DayMap"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />,
});

const TYPE_STYLES: Record<string, string> = {
  activity: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  meal: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  transport: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  rest: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

function osmUrl(placeId: string): string {
  // "osm:node/123" -> https://www.openstreetmap.org/node/123
  return `https://www.openstreetmap.org/${placeId.replace(/^osm:/, "")}`;
}

export function ItineraryView({ result }: { result: PlanResult }) {
  const { itinerary, places, warnings } = result;
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">{itinerary.destination}</h2>
        <p className="text-zinc-600 dark:text-zinc-400">{itinerary.summary}</p>
        {itinerary.estimatedTotalPerPerson !== null && (
          <p className="text-sm font-medium">
            Estimated total per person: {itinerary.estimatedTotalPerPerson.toLocaleString()}{" "}
            {itinerary.currency}
          </p>
        )}
      </header>

      {itinerary.days.map((day) => {
        const stops = dayStops(day, places);
        return (
          <article
            key={day.day}
            className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">
                Day {day.day}: {day.theme}
              </h3>
              <span className="text-sm text-zinc-500">
                {day.date} · {day.area}
              </span>
            </div>
            {day.weatherNote && (
              <p className="mb-3 text-sm text-zinc-500">Weather: {day.weatherNote}</p>
            )}
            {stops.length > 0 && (
              <div className="mb-4">
                <DayMap stops={stops} />
              </div>
            )}
            <ol className="space-y-3">
              {day.items.map((item, i) => {
                const stop = stops.find((s) => s.itemIndex === i);
                return (
                  <li key={i} className="grid grid-cols-[3.5rem_1fr] gap-3">
                    <span className="pt-0.5 font-mono text-sm text-zinc-500">{item.time}</span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {stop && (
                          <span
                            aria-label={`Map stop ${stop.order}`}
                            className="flex size-5 items-center justify-center rounded-full bg-sky-600 text-[11px] font-semibold text-white"
                          >
                            {stop.order}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[item.type]}`}
                        >
                          {item.type}
                        </span>
                        <span className="font-medium">
                          {item.placeId ? (
                            <a
                              href={osmUrl(item.placeId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline decoration-zinc-300 underline-offset-4 hover:decoration-current"
                            >
                              {item.title}
                            </a>
                          ) : (
                            item.title
                          )}
                        </span>
                        {item.estimatedCostPerPerson !== null && (
                          <span className="text-xs text-zinc-500">
                            ~{item.estimatedCostPerPerson} {itinerary.currency}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.whyItFits}</p>
                      {item.notes && <p className="text-sm text-zinc-500">{item.notes}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
        );
      })}

      {itinerary.tips.length > 0 && (
        <aside className="rounded-2xl bg-zinc-100 p-5 dark:bg-zinc-900">
          <h3 className="mb-2 font-semibold">Local tips</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {itinerary.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </aside>
      )}

      {warnings.length > 0 && (
        <details className="text-xs text-zinc-500">
          <summary>Quality checks ({warnings.length})</summary>
          <ul className="mt-2 list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-zinc-500">
        Places from OpenStreetMap, weather from Open-Meteo. Check opening hours and prices before
        you go.
      </p>
    </section>
  );
}
