// OSM services (Nominatim, Overpass) require an identifying User-Agent.
export const USER_AGENT = "TripMind/0.1 (+https://github.com/AnnuThukral/tripmind)";

export class UpstreamError extends Error {
  constructor(
    public readonly service: string,
    message: string,
  ) {
    super(`${service}: ${message}`);
    this.name = "UpstreamError";
  }
}

export async function fetchJson<T>(
  service: string,
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new UpstreamError(service, err instanceof Error ? err.message : String(err));
  }
  if (!res.ok) throw new UpstreamError(service, `HTTP ${res.status}`);
  return (await res.json()) as T;
}
