"use client";

import { useRef, useState } from "react";
import type { PlanResult } from "@/lib/agent/planner";
import type { TripRequest } from "@/lib/schema/trip";
import { deleteTrip, listTrips, type SavedTrip } from "@/lib/storage";
import { IdeasPanel } from "./IdeasPanel";
import { TripForm, type FormPrefill } from "./TripForm";
import { TripResult } from "./TripResult";
import { Chip } from "./ui";

interface Current {
  trip: TripRequest;
  result: PlanResult;
  savedId: string | null;
}

export function Planner() {
  const [mode, setMode] = useState<"plan" | "ideas">("plan");
  const [prefill, setPrefill] = useState<FormPrefill | undefined>();
  // Changing the key remounts the form so a picked idea replaces its fields.
  const [formKey, setFormKey] = useState(0);
  const [current, setCurrent] = useState<Current | null>(null);
  const [saved, setSaved] = useState<SavedTrip[]>(listTrips);
  const resultRef = useRef<HTMLDivElement>(null);

  function show(next: Current) {
    setCurrent(next);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <div className="space-y-12">
      <div className="space-y-6 print:hidden">
        <div className="flex gap-2" role="tablist" aria-label="How to start">
          <Chip tone="dark" role="tab" pressed={mode === "plan"} onClick={() => setMode("plan")}>
            I know where I&apos;m going
          </Chip>
          <Chip tone="dark" role="tab" pressed={mode === "ideas"} onClick={() => setMode("ideas")}>
            Help me choose
          </Chip>
        </div>

        {mode === "plan" ? (
          <TripForm
            key={formKey}
            prefill={prefill}
            onPlanned={(trip, result) => show({ trip, result, savedId: null })}
          />
        ) : (
          <IdeasPanel
            onPick={(p) => {
              setPrefill(p);
              setFormKey((k) => k + 1);
              setMode("plan");
            }}
          />
        )}
      </div>

      <div ref={resultRef} className="scroll-mt-6">
        {current && (
          <TripResult
            key={current.savedId ?? "unsaved"}
            trip={current.trip}
            result={current.result}
            savedId={current.savedId}
            onResultChange={(result) => setCurrent({ ...current, result })}
            onSaved={(id) => {
              setCurrent({ ...current, savedId: id });
              setSaved(listTrips());
            }}
          />
        )}
      </div>

      {saved.length > 0 && (
        <section className="space-y-3 print:hidden">
          <h2 className="text-lg font-semibold">My trips</h2>
          <ul className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {saved.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => show({ trip: t.trip, result: t.result, savedId: t.id })}
                >
                  <span className="font-medium">{t.result.itinerary.destination}</span>
                  <span className="block text-xs text-zinc-500">
                    {t.trip.startDate} to {t.trip.endDate}
                  </span>
                </button>
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:text-red-600"
                  onClick={() => {
                    deleteTrip(t.id);
                    setSaved(listTrips());
                    if (current?.savedId === t.id) setCurrent({ ...current, savedId: null });
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">
            Saved in this browser only. Use “Share link” to open a trip on another device.
          </p>
        </section>
      )}
    </div>
  );
}
