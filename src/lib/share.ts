import type { PlanResult } from "@/lib/agent/planner";
import type { TripRequest } from "@/lib/schema/trip";

/**
 * A whole trip packed into a URL fragment (deflate + base64url), so sharing
 * needs no database. The fragment is never sent to the server.
 */
export interface SharedTrip {
  v: 1;
  trip: TripRequest;
  result: Pick<PlanResult, "itinerary" | "places">;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const binary = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: GenericTransformStream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeTrip(trip: TripRequest, result: PlanResult): Promise<string> {
  const payload: SharedTrip = {
    v: 1,
    trip,
    result: { itinerary: result.itinerary, places: result.places },
  };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeTrip(encoded: string): Promise<SharedTrip | null> {
  try {
    const json = await pipe(fromBase64Url(encoded), new DecompressionStream("deflate-raw"));
    const data = JSON.parse(new TextDecoder().decode(json)) as SharedTrip;
    return data?.v === 1 && data.result?.itinerary?.days ? data : null;
  } catch {
    return null;
  }
}
