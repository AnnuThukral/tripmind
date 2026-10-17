"use client";

import dynamic from "next/dynamic";
import type { PlanResult } from "@/lib/agent/planner";
import { dayDirectionsUrl } from "@/lib/itinerary/links";
import { dayStops } from "@/lib/itinerary/stops";
import type { ItineraryItem } from "@/lib/schema/trip";
import type { Feedback } from "@/lib/storage";

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

/** What we remember about an item for personalization. */
export function feedbackLabel(item: ItineraryItem): string {
  return (item.placeName ?? item.title).slice(0, 80);
}

export interface ItineraryActions {
  busyDays: number[];
  onRegenerateDay: (day: number) => void;
  onSwapItem: (day: number, itemIndex: number) => void;
  feedback: Feedback;
  onVote: (label: string, vote: "liked" | "disliked" | null) => void;
}

const iconButton =
  "rounded-md px-1.5 py-0.5 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 aria-pressed:bg-zinc-200 aria-pressed:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:aria-pressed:bg-zinc-700 dark:aria-pressed:text-white";

export function ItineraryView({
  result,
  actions,
}: {
  result: Pick<PlanResult, "itinerary" | "places">;
  actions?: ItineraryActions;
}) {
  const { itinerary, places } = result;
  return (
    <div className="space-y-6">
      {itinerary.days.map((day) => {
        const stops = dayStops(day, places);
        const directions = dayDirectionsUrl(stops);
        const busy = actions?.busyDays.includes(day.day) ?? false;
        return (
          <article
            key={day.day}
            aria-busy={busy}
            className="break-inside-avoid rounded-2xl border border-zinc-200 p-5 aria-busy:animate-pulse dark:border-zinc-800"
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
              <div className="mb-2 print:hidden">
                <DayMap stops={stops} />
              </div>
            )}
            {(directions || actions) && (
              <div className="mb-4 flex flex-wrap gap-3 text-sm print:hidden">
                {directions && (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 underline underline-offset-4 dark:text-sky-400"
                  >
                    Walking route in Google Maps
                  </a>
                )}
                {actions && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => actions.onRegenerateDay(day.day)}
                    className="text-sky-700 underline underline-offset-4 disabled:opacity-50 dark:text-sky-400"
                  >
                    {busy ? "Updating…" : "Regenerate this day"}
                  </button>
                )}
              </div>
            )}
            <ol className="space-y-3">
              {day.items.map((item, i) => {
                const stop = stops.find((s) => s.itemIndex === i);
                const label = feedbackLabel(item);
                const vote = actions?.feedback.liked.includes(label)
                  ? "liked"
                  : actions?.feedback.disliked.includes(label)
                    ? "disliked"
                    : null;
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
                        {actions && (
                          <span className="ml-auto flex gap-1 print:hidden">
                            <button
                              type="button"
                              className={iconButton}
                              aria-pressed={vote === "liked"}
                              aria-label={`Like ${item.title}`}
                              title="More like this on future trips"
                              onClick={() =>
                                actions.onVote(label, vote === "liked" ? null : "liked")
                              }
                            >
                              👍
                            </button>
                            <button
                              type="button"
                              className={iconButton}
                              aria-pressed={vote === "disliked"}
                              aria-label={`Dislike ${item.title}`}
                              title="Less like this on future trips"
                              onClick={() =>
                                actions.onVote(label, vote === "disliked" ? null : "disliked")
                              }
                            >
                              👎
                            </button>
                            <button
                              type="button"
                              className={iconButton}
                              disabled={busy}
                              title="Replace with a different option"
                              onClick={() => actions.onSwapItem(day.day, i)}
                            >
                              Swap
                            </button>
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
    </div>
  );
}
