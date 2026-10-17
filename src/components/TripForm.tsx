"use client";

import { useState } from "react";
import type { PlanResult } from "@/lib/agent/planner";
import { INTERESTS, MAX_TRIP_DAYS, PACES } from "@/lib/schema/trip";
import { ItineraryView } from "./ItineraryView";

const DIETARY = ["vegetarian", "vegan", "halal", "kosher", "gluten-free"] as const;

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

function isoToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function TripForm() {
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(isoToday(7));
  const [endDate, setEndDate] = useState(isoToday(9));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [pace, setPace] = useState<(typeof PACES)[number]>("balanced");
  const [interests, setInterests] = useState<string[]>(["food", "history"]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          travelers: { adults, children },
          budget: budget ? { amount: Number(budget), currency, per: "trip" } : undefined,
          pace,
          interests,
          dietary,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const issue = data.issues?.[0]?.message;
        throw new Error(issue ? `${data.error} ${issue}` : data.error);
      }
      setResult(data as PlanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <form onSubmit={onSubmit} className="space-y-6">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Where to?</span>
          <input
            required
            minLength={2}
            className={inputClass}
            placeholder="Lisbon, Portugal"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Start date</span>
            <input
              type="date"
              required
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">End date (max {MAX_TRIP_DAYS} days)</span>
            <input
              type="date"
              required
              min={startDate}
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Adults</span>
            <input
              type="number"
              min={1}
              max={20}
              className={inputClass}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Children</span>
            <input
              type="number"
              min={0}
              max={20}
              className={inputClass}
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Budget (optional)</span>
            <input
              type="number"
              min={1}
              className={inputClass}
              placeholder="1500"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Currency</span>
            <input
              maxLength={3}
              className={`${inputClass} uppercase`}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Pace</legend>
          <div className="flex flex-wrap gap-2">
            {PACES.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPace(p)}
                aria-pressed={pace === p}
                className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm capitalize aria-pressed:border-zinc-900 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:border-zinc-700 dark:aria-pressed:border-white dark:aria-pressed:bg-white dark:aria-pressed:text-black"
              >
                {p}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Interests</legend>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <button
                type="button"
                key={i}
                onClick={() => setInterests(toggle(interests, i))}
                aria-pressed={interests.includes(i)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-sm capitalize aria-pressed:border-sky-600 aria-pressed:bg-sky-600 aria-pressed:text-white dark:border-zinc-700"
              >
                {i}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Dietary needs</legend>
          <div className="flex flex-wrap gap-2">
            {DIETARY.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDietary(toggle(dietary, d))}
                aria-pressed={dietary.includes(d)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-sm capitalize aria-pressed:border-amber-600 aria-pressed:bg-amber-600 aria-pressed:text-white dark:border-zinc-700"
              >
                {d}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Anything else? (optional)</span>
          <textarea
            maxLength={500}
            rows={2}
            className={inputClass}
            placeholder="First time visiting, no long drives, love rooftop views…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 sm:w-auto dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          {loading ? "Planning your trip… (up to a minute)" : "Plan my trip"}
        </button>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      {result && <ItineraryView result={result} />}
    </div>
  );
}
