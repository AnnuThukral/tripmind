// TEMPORARY: diagnoses Overpass reachability from Vercel. Remove after use.
import { connection } from "next/server";
import { USER_AGENT } from "@/lib/tools/http";
import { OVERPASS_ENDPOINTS } from "@/lib/tools/places";

export const maxDuration = 120;

const QUERY =
  '[out:json][timeout:25];(nwr["tourism"~"^(museum|gallery)$"]["name"](around:2000,38.708,-9.137););out center tags 10;';

export async function GET() {
  await connection();
  const results = await Promise.all(
    OVERPASS_ENDPOINTS.map(async (endpoint) => {
      const start = Date.now();
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          body: new URLSearchParams({ data: QUERY }),
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          signal: AbortSignal.timeout(40_000),
        });
        const text = await res.text();
        return { endpoint, status: res.status, ms: Date.now() - start, body: text.slice(0, 160) };
      } catch (err) {
        return { endpoint, error: String(err), ms: Date.now() - start };
      }
    }),
  );
  return Response.json({ region: process.env.VERCEL_REGION ?? null, results });
}
