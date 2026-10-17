"use client";

import { useState } from "react";
import type { PlanResult } from "@/lib/agent/planner";
import { postJson } from "@/lib/client";
import { INTERESTS, MAX_TRIP_DAYS, PACES, type TripRequest } from "@/lib/schema/trip";
import { loadFeedback, loadProfile, saveProfile } from "@/lib/storage";
import { Chip, inputClass, PrimaryButton, toggle } from "./ui";

const DIETARY = ["vegetarian", "vegan", "halal", "kosher", "gluten-free"] as const;

function isoToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export interface FormPrefill {
  destination: string;
  startDate?: string;
  endDate?: string;
}

export function TripForm({
  prefill,
  onPlanned,
}: {
  prefill?: FormPrefill;
  onPlanned: (trip: TripRequest, result: PlanResult) => void;
}) {
  // Only rendered in the browser (see page.tsx), so reading storage here is safe.
  const [profile] = useState(loadProfile);
  const [destination, setDestination] = useState(prefill?.destination ?? "");
  const [startDate, setStartDate] = useState(prefill?.startDate ?? isoToday(7));
  const [endDate, setEndDate] = useState(prefill?.endDate ?? isoToday(9));
  const [adults, setAdults] = useState(profile.adults ?? 2);
  const [children, setChildren] = useState(profile.children ?? 0);
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState(profile.currency ?? "USD");
  const [pace, setPace] = useState<(typeof PACES)[number]>(profile.pace ?? "balanced");
  const [interests, setInterests] = useState<string[]>(profile.interests ?? ["food", "history"]);
  const [dietary, setDietary] = useState<string[]>(profile.dietary ?? []);
  const [origin, setOrigin] = useState(profile.origin ?? "");
  const [passportCountry, setPassportCountry] = useState(profile.passportCountry ?? "");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const feedback = loadFeedback();
    const trip = {
      destination,
      startDate,
      endDate,
      travelers: { adults, children },
      budget: budget ? { amount: Number(budget), currency, per: "trip" as const } : undefined,
      pace,
      interests,
      dietary,
      notes: notes || undefined,
      origin: origin || undefined,
      passportCountry: passportCountry || undefined,
      feedback: feedback.liked.length || feedback.disliked.length ? feedback : undefined,
    } satisfies Partial<TripRequest>;
    saveProfile({
      adults,
      children,
      currency,
      pace,
      interests,
      dietary,
      origin: origin || undefined,
      passportCountry: passportCountry || undefined,
    });
    try {
      const result = await postJson<PlanResult>("/api/plan", trip);
      onPlanned(trip as TripRequest, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
            <Chip key={p} tone="dark" pressed={pace === p} onClick={() => setPace(p)}>
              {p}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Interests</legend>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <Chip
              key={i}
              pressed={interests.includes(i)}
              onClick={() => setInterests(toggle(interests, i))}
            >
              {i}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Dietary needs</legend>
        <div className="flex flex-wrap gap-2">
          {DIETARY.map((d) => (
            <Chip
              key={d}
              tone="amber"
              pressed={dietary.includes(d)}
              onClick={() => setDietary(toggle(dietary, d))}
            >
              {d}
            </Chip>
          ))}
        </div>
      </fieldset>

      <details className="group rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-medium">
          More options: travelling from, passport, notes
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Travelling from</span>
              <input
                className={inputClass}
                placeholder="Delhi, India"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
              <span className="text-xs text-zinc-500">Adds flight and train search links.</span>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Passport country</span>
              <input
                className={inputClass}
                placeholder="India"
                value={passportCountry}
                onChange={(e) => setPassportCountry(e.target.value)}
              />
              <span className="text-xs text-zinc-500">For the visa and entry note.</span>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Anything else?</span>
            <textarea
              maxLength={500}
              rows={2}
              className={inputClass}
              placeholder="First time visiting, no long drives, love rooftop views…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
      </details>

      <PrimaryButton type="submit" disabled={loading}>
        {loading ? "Planning your trip… (up to a minute)" : "Plan my trip"}
      </PrimaryButton>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
