"use client";

import { useState } from "react";
import type { PlanResult } from "@/lib/agent/planner";
import type { ReviseResult } from "@/lib/agent/revise";
import { postJson } from "@/lib/client";
import { itineraryToIcs } from "@/lib/itinerary/ics";
import type { TripRequest } from "@/lib/schema/trip";
import { encodeTrip } from "@/lib/share";
import { loadFeedback, recordFeedback, saveTrip } from "@/lib/storage";
import { ItineraryView } from "./ItineraryView";
import {
  BudgetPanel,
  EssentialsPanel,
  GettingAroundPanel,
  PackingPanel,
  StayPanel,
  TipsPanel,
} from "./TripExtras";
import { inputClass, SmallButton } from "./ui";

export function TripResult({
  trip,
  result,
  savedId,
  onResultChange,
  onSaved,
}: {
  trip: TripRequest;
  result: PlanResult;
  savedId: string | null;
  onResultChange: (result: PlanResult) => void;
  onSaved: (id: string) => void;
}) {
  const { itinerary } = result;
  const [busyDays, setBusyDays] = useState<number[]>([]);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(loadFeedback);
  const editing = busyDays.length > 0;

  function persist(next: PlanResult) {
    if (savedId) saveTrip(trip, next, savedId);
  }

  async function revise(text: string, days: number[]) {
    setBusyDays(days);
    setError(null);
    setStatus(null);
    try {
      const r = await postJson<ReviseResult & { remainingToday?: number }>("/api/revise", {
        trip,
        itinerary,
        instruction: text,
      });
      const next: PlanResult = {
        ...result,
        itinerary: r.itinerary,
        places: { ...result.places, ...r.places },
        warnings: r.warnings,
      };
      onResultChange(next);
      persist(next);
      setStatus(
        r.note + (r.remainingToday !== undefined ? ` (${r.remainingToday} edits left today)` : ""),
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusyDays([]);
    }
  }

  async function onChat(e: React.FormEvent) {
    e.preventDefault();
    if (instruction.trim().length < 3) return;
    const ok = await revise(
      instruction.trim(),
      itinerary.days.map((d) => d.day),
    );
    if (ok) setInstruction("");
  }

  function onSave() {
    const saved = saveTrip(trip, result, savedId ?? undefined);
    if (saved) {
      onSaved(saved.id);
      setStatus("Saved to My trips on this device.");
    } else {
      setError("Couldn't save. Your browser may be blocking storage.");
    }
  }

  async function onShare() {
    setError(null);
    try {
      const url = `${window.location.origin}/trip#${await encodeTrip(trip, result)}`;
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setStatus("Share link copied. Anyone with it can view this trip.");
      } catch {
        setStatus("Copy the share link below.");
      }
    } catch {
      setError("Couldn't create a share link in this browser.");
    }
  }

  function onCalendar() {
    const blob = new Blob([itineraryToIcs(itinerary)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tripmind-${itinerary.destination.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onVote(label: string, vote: "liked" | "disliked" | null) {
    setFeedback(recordFeedback(label, vote));
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold">{itinerary.destination}</h2>
        <p className="text-zinc-600 dark:text-zinc-400">{itinerary.summary}</p>
        {itinerary.estimatedTotalPerPerson !== null && (
          <p className="text-sm font-medium">
            About {itinerary.estimatedTotalPerPerson.toLocaleString()} {itinerary.currency} per
            person for food, activities, and local transport
          </p>
        )}
        {result.remainingToday !== undefined && (
          <p className="text-xs text-zinc-500 print:hidden">
            {result.remainingToday} free trip plan{result.remainingToday === 1 ? "" : "s"} left
            today.
          </p>
        )}
      </header>

      <div className="flex flex-wrap gap-2 print:hidden">
        <SmallButton onClick={onSave}>{savedId ? "Save changes" : "Save trip"}</SmallButton>
        <SmallButton onClick={onShare}>Share link</SmallButton>
        <SmallButton onClick={() => window.print()}>Print / PDF</SmallButton>
        <SmallButton onClick={onCalendar}>Add to calendar</SmallButton>
      </div>

      {shareUrl && (
        <input
          readOnly
          aria-label="Share link"
          className={`${inputClass} text-xs print:hidden`}
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}

      <form onSubmit={onChat} className="flex flex-col gap-2 sm:flex-row print:hidden">
        <input
          className={inputClass}
          maxLength={300}
          placeholder="Ask for changes: “make day 2 more relaxed”, “add a cooking class”…"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={editing}
        />
        <SmallButton type="submit" disabled={editing || instruction.trim().length < 3}>
          {editing ? "Updating…" : "Update plan"}
        </SmallButton>
      </form>

      <div aria-live="polite" className="print:hidden">
        {status && <p className="text-sm text-emerald-700 dark:text-emerald-400">{status}</p>}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <ItineraryView
        result={result}
        actions={{
          busyDays,
          feedback,
          onVote,
          onRegenerateDay: (day) =>
            revise(
              `Create a completely different plan for day ${day}, with different places, still clustered in one sensible area.`,
              [day],
            ),
          onSwapItem: (day, index) => {
            const item = itinerary.days.find((d) => d.day === day)?.items[index];
            if (!item) return;
            revise(
              `On day ${day}, replace "${item.title}" at ${item.time} with a different ${item.type} option that fits the same time slot. Keep every other item on day ${day} unchanged.`,
              [day],
            );
          },
        }}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <StayPanel itinerary={itinerary} trip={trip} />
        <GettingAroundPanel itinerary={itinerary} trip={trip} />
        <BudgetPanel itinerary={itinerary} trip={trip} />
        <EssentialsPanel itinerary={itinerary} />
        <PackingPanel items={itinerary.packingList} />
        <TipsPanel tips={itinerary.tips} />
      </div>

      {result.warnings.length > 0 && (
        <details className="text-xs text-zinc-500 print:hidden">
          <summary>Quality checks ({result.warnings.length})</summary>
          <ul className="mt-2 list-disc pl-5">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-zinc-500">
        Places from OpenStreetMap, weather from Open-Meteo, plan by Claude. Check opening hours and
        prices before you go.
      </p>
    </section>
  );
}
