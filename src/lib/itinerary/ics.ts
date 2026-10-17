import type { Itinerary } from "@/lib/schema/trip";

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "2026-11-01" + "09:30" + 90 min -> floating local times (no timezone), per RFC 5545. */
function stamp(date: string, time: string, addMinutes = 0): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes((h || 0) * 60 + (m || 0) + addMinutes);
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15);
}

/** One calendar event per itinerary item, in the destination's local time. */
export function itineraryToIcs(itinerary: Itinerary, now: Date = new Date()): string {
  const dtstamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TripMind//Itinerary//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(`TripMind: ${itinerary.destination}`)}`,
  ];
  for (const day of itinerary.days) {
    day.items.forEach((item, i) => {
      if (!/^\d{1,2}:\d{2}$/.test(item.time)) return;
      const duration = item.durationMinutes ?? 60;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${day.date}-${i}-${item.time.replace(":", "")}@tripmind`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${stamp(day.date, item.time)}`,
        `DTEND:${stamp(day.date, item.time, duration)}`,
        `SUMMARY:${escapeText(item.title)}`,
        `DESCRIPTION:${escapeText([item.whyItFits, item.notes].filter(Boolean).join("\n"))}`,
        ...(item.placeName ? [`LOCATION:${escapeText(item.placeName)}`] : []),
        "END:VEVENT",
      );
    });
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
