"use client";

import { useState } from "react";
import { budgetBreakdown } from "@/lib/itinerary/budget";
import { bookingLinks, type BookingLink } from "@/lib/itinerary/links";
import type { Itinerary, TripRequest } from "@/lib/schema/trip";
import { Panel } from "./ui";

function money(n: number, currency: string): string {
  return `${Math.round(n).toLocaleString()} ${currency}`;
}

function LinkList({ links }: { links: BookingLink[] }) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}

export function StayPanel({ itinerary, trip }: { itinerary: Itinerary; trip: TripRequest }) {
  const { stay } = itinerary;
  const links = bookingLinks(trip, stay.area);
  return (
    <Panel title="Where to stay">
      <p className="font-medium">{stay.area}</p>
      <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">{stay.why}</p>
      {stay.alternatives.length > 0 && (
        <ul className="mb-3 list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          {stay.alternatives.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {stay.estimatedNightlyCost !== null && (
        <p className="mb-3 text-sm">
          Typical mid-range room: ~{money(stay.estimatedNightlyCost, itinerary.currency)} / night
        </p>
      )}
      <LinkList links={links.filter((l) => l.kind === "stay")} />
    </Panel>
  );
}

export function GettingAroundPanel({
  itinerary,
  trip,
}: {
  itinerary: Itinerary;
  trip: TripRequest;
}) {
  const links = bookingLinks(trip).filter((l) => l.kind !== "stay");
  return (
    <Panel title="Getting there and around">
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        {itinerary.essentials.gettingAround}
      </p>
      {!trip.origin && (
        <p className="mb-3 text-xs text-zinc-500 print:hidden">
          Add “Travelling from” when planning to get flight and train links.
        </p>
      )}
      <LinkList links={links} />
    </Panel>
  );
}

export function BudgetPanel({ itinerary, trip }: { itinerary: Itinerary; trip: TripRequest }) {
  const b = budgetBreakdown(itinerary, trip);
  const rows: [string, number][] = [
    ["Food", b.perPerson.food * b.travelers],
    ["Activities", b.perPerson.activities * b.travelers],
    ["Local transport", b.perPerson.transport * b.travelers],
  ];
  if (b.stay !== null) rows.push([`Stay (${b.nights} night${b.nights === 1 ? "" : "s"})`, b.stay]);
  return (
    <Panel title="Estimated budget">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="py-1.5">{label}</td>
              <td className="py-1.5 text-right tabular-nums">{money(value, b.currency)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="pt-2">
              Total for {b.travelers} traveler{b.travelers === 1 ? "" : "s"}
            </td>
            <td className="pt-2 text-right tabular-nums">{money(b.groupTotal, b.currency)}</td>
          </tr>
        </tbody>
      </table>
      {b.budget && (
        <p className="mt-3 text-sm">
          Your budget: {money(b.budget.amount, b.budget.currency)}
          {b.overBudgetBy === null
            ? " (different currency, so not compared)"
            : b.overBudgetBy > 0
              ? `, about ${money(b.overBudgetBy, b.currency)} over`
              : ", within budget"}
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        Rough estimates from the plan. Flights are not included.
      </p>
    </Panel>
  );
}

export function PackingPanel({ items }: { items: string[] }) {
  const [packed, setPacked] = useState<string[]>([]);
  if (items.length === 0) return null;
  return (
    <Panel title="Packing list">
      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
        {items.map((item) => (
          <li key={item}>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={packed.includes(item)}
                onChange={() =>
                  setPacked((p) => (p.includes(item) ? p.filter((x) => x !== item) : [...p, item]))
                }
              />
              <span className={packed.includes(item) ? "text-zinc-400 line-through" : ""}>
                {item}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function EssentialsPanel({ itinerary }: { itinerary: Itinerary }) {
  const e = itinerary.essentials;
  const rows: [string, string][] = [
    ["Entry and visa", e.entryRequirements],
    ["Money and tipping", e.currency],
    ["Language", e.language],
    ["Plugs", e.plugs],
    ["Emergency number", e.emergencyNumber],
    ["Safety", e.safety],
  ];
  return (
    <Panel title="Before you go">
      <dl className="space-y-3 text-sm">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="font-medium">{label}</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{value}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-3 text-xs text-zinc-500">
        AI-generated guidance. Always confirm visa and entry rules with the official government or
        embassy website before you travel.
      </p>
    </Panel>
  );
}

export function TipsPanel({ tips }: { tips: string[] }) {
  if (tips.length === 0) return null;
  return (
    <Panel title="Local tips">
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </Panel>
  );
}
