import type { PlanResult } from "@/lib/agent/planner";
import type { TripRequest } from "@/lib/schema/trip";

// Everything here lives in the visitor's own browser (no accounts yet). Every
// access is wrapped because storage can be blocked or full.

const KEYS = {
  trips: "tripmind:trips:v1",
  profile: "tripmind:profile:v1",
  feedback: "tripmind:feedback:v1",
};

const MAX_SAVED_TRIPS = 20;
const MAX_FEEDBACK = 10;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export interface SavedTrip {
  id: string;
  savedAt: string;
  trip: TripRequest;
  result: PlanResult;
}

export function listTrips(): SavedTrip[] {
  return read<SavedTrip[]>(KEYS.trips, []);
}

export function getTrip(id: string): SavedTrip | null {
  return listTrips().find((t) => t.id === id) ?? null;
}

/** Saves or updates (same id) a trip; newest first, capped. */
export function saveTrip(trip: TripRequest, result: PlanResult, id?: string): SavedTrip | null {
  const saved: SavedTrip = {
    id: id ?? crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    trip,
    result,
  };
  const trips = [saved, ...listTrips().filter((t) => t.id !== saved.id)].slice(0, MAX_SAVED_TRIPS);
  return write(KEYS.trips, trips) ? saved : null;
}

export function deleteTrip(id: string): void {
  write(
    KEYS.trips,
    listTrips().filter((t) => t.id !== id),
  );
}

/** Preferences remembered between visits to prefill the form. */
export type Profile = Partial<
  Pick<TripRequest, "pace" | "interests" | "dietary" | "origin" | "passportCountry"> & {
    adults: number;
    children: number;
    currency: string;
  }
>;

export function loadProfile(): Profile {
  return read<Profile>(KEYS.profile, {});
}

export function saveProfile(profile: Profile): void {
  write(KEYS.profile, profile);
}

export interface Feedback {
  liked: string[];
  disliked: string[];
}

export function loadFeedback(): Feedback {
  return read<Feedback>(KEYS.feedback, { liked: [], disliked: [] });
}

/** Records a thumbs up/down; the same label moves between lists, newest first. */
export function recordFeedback(label: string, vote: "liked" | "disliked" | null): Feedback {
  const current = loadFeedback();
  const strip = (list: string[]) => list.filter((l) => l !== label);
  const next: Feedback = { liked: strip(current.liked), disliked: strip(current.disliked) };
  if (vote) next[vote] = [label, ...next[vote]].slice(0, MAX_FEEDBACK);
  write(KEYS.feedback, next);
  return next;
}
