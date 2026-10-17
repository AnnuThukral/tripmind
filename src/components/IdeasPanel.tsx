"use client";

import { useState } from "react";
import { postJson } from "@/lib/client";
import { BUDGET_LEVELS, VIBES, type DestinationIdea } from "@/lib/schema/ideas";
import { MAX_TRIP_DAYS } from "@/lib/schema/trip";
import { loadProfile } from "@/lib/storage";
import type { FormPrefill } from "./TripForm";
import { Chip, inputClass, PrimaryButton, SmallButton, toggle } from "./ui";

function nextMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 7);
}

/** First weekend-ish start in the month (or a week from today if that's sooner). */
function datesFor(month: string, days: number): { startDate: string; endDate: string } {
  const soonest = new Date();
  soonest.setDate(soonest.getDate() + 7);
  const first = new Date(`${month}-01T00:00:00`);
  const start = first > soonest ? first : soonest;
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: iso(start), endDate: iso(end) };
}

export function IdeasPanel({ onPick }: { onPick: (prefill: FormPrefill) => void }) {
  const [profile] = useState(loadProfile);
  const [month, setMonth] = useState(nextMonth);
  const [tripDays, setTripDays] = useState(4);
  const [vibes, setVibes] = useState<string[]>(["culture", "food"]);
  const [budgetLevel, setBudgetLevel] = useState<(typeof BUDGET_LEVELS)[number]>("mid-range");
  const [origin, setOrigin] = useState(profile.origin ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<DestinationIdea[] | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (vibes.length === 0) {
      setError("Pick at least one vibe.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ ideas: DestinationIdea[] }>("/api/ideas", {
        month,
        tripDays,
        vibes,
        budgetLevel,
        origin: origin || undefined,
        passportCountry: profile.passportCountry,
      });
      setIdeas(data.ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">When</span>
            <input
              type="month"
              required
              className={inputClass}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Days</span>
            <input
              type="number"
              min={1}
              max={MAX_TRIP_DAYS}
              className={inputClass}
              value={tripDays}
              onChange={(e) => setTripDays(Number(e.target.value))}
            />
          </label>
          <label className="col-span-2 block space-y-1 sm:col-span-1">
            <span className="text-sm font-medium">From (optional)</span>
            <input
              className={inputClass}
              placeholder="Delhi, India"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What kind of trip?</legend>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <Chip key={v} pressed={vibes.includes(v)} onClick={() => setVibes(toggle(vibes, v))}>
                {v}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Budget</legend>
          <div className="flex flex-wrap gap-2">
            {BUDGET_LEVELS.map((b) => (
              <Chip
                key={b}
                tone="dark"
                pressed={budgetLevel === b}
                onClick={() => setBudgetLevel(b)}
              >
                {b}
              </Chip>
            ))}
          </div>
        </fieldset>

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? "Finding ideas…" : "Suggest destinations"}
        </PrimaryButton>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      {ideas && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {ideas.map((idea) => (
            <li
              key={idea.destination}
              className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
            >
              <h3 className="text-lg font-semibold">{idea.destination}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{idea.why}</p>
              <ul className="list-disc pl-5 text-sm">
                {idea.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <dl className="space-y-1 text-xs text-zinc-500">
                <div>
                  <dt className="inline font-medium">Weather: </dt>
                  <dd className="inline">{idea.weatherInMonth}</dd>
                </div>
                {idea.typicalDailyCostUsd !== null && (
                  <div>
                    <dt className="inline font-medium">Typical cost: </dt>
                    <dd className="inline">~${idea.typicalDailyCostUsd}/person/day</dd>
                  </div>
                )}
                {idea.gettingThere && (
                  <div>
                    <dt className="inline font-medium">Getting there: </dt>
                    <dd className="inline">{idea.gettingThere}</dd>
                  </div>
                )}
                {idea.watchOut && (
                  <div>
                    <dt className="inline font-medium">Watch out: </dt>
                    <dd className="inline">{idea.watchOut}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-auto pt-2">
                <SmallButton
                  onClick={() =>
                    onPick({ destination: idea.destination, ...datesFor(month, tripDays) })
                  }
                >
                  Plan this trip →
                </SmallButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
