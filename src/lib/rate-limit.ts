// Daily trip-generation quotas: per visitor (by IP) and a global cap that
// bounds total AI spend. Uses Upstash Redis over REST when configured; falls
// back to per-instance memory, which is best-effort on serverless.

export interface LimitResult {
  allowed: boolean;
  reason?: "visitor" | "global";
  remaining: number;
}

export interface LimitConfig {
  perVisitor: number;
  global: number;
}

export function limitConfig(env: Record<string, string | undefined> = process.env): LimitConfig {
  return {
    perVisitor: Number(env.DAILY_TRIPS_PER_VISITOR) || 3,
    global: Number(env.DAILY_TRIPS_GLOBAL) || 200,
  };
}

/** Fixed daily window, keyed by UTC date. */
export function dayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function visitorId(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

type Counter = (key: string, ttlSeconds: number) => Promise<number>;

const memory = new Map<string, number>();
const memoryCounter: Counter = async (key) => {
  const next = (memory.get(key) ?? 0) + 1;
  memory.set(key, next);
  return next;
};

function upstashCounter(url: string, token: string): Counter {
  return async (key, ttlSeconds) => {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(ttlSeconds), "NX"],
      ]),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
    const [incr] = (await res.json()) as [{ result: number }];
    return incr.result;
  };
}

function defaultCounter(): Counter {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
  return url && token ? upstashCounter(url, token) : memoryCounter;
}

/** Counts one trip generation and reports whether it is within quota. */
export async function consumeTripQuota(
  visitor: string,
  config: LimitConfig = limitConfig(),
  counter: Counter = defaultCounter(),
  now: Date = new Date(),
): Promise<LimitResult> {
  const day = dayKey(now);
  const ttl = 60 * 60 * 26;
  let visitorCount: number;
  let globalCount: number;
  try {
    [visitorCount, globalCount] = await Promise.all([
      counter(`trips:${day}:v:${visitor}`, ttl),
      counter(`trips:${day}:all`, ttl),
    ]);
  } catch (err) {
    // If the limiter store is down, fall back to memory rather than blocking everyone.
    console.error("Rate limiter unavailable, using memory", err);
    [visitorCount, globalCount] = await Promise.all([
      memoryCounter(`trips:${day}:v:${visitor}`, ttl),
      memoryCounter(`trips:${day}:all`, ttl),
    ]);
  }
  if (globalCount > config.global) return { allowed: false, reason: "global", remaining: 0 };
  if (visitorCount > config.perVisitor) return { allowed: false, reason: "visitor", remaining: 0 };
  return { allowed: true, remaining: config.perVisitor - visitorCount };
}
