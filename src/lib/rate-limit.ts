// Daily AI-call quotas, per visitor (by IP) and globally, so total spend stays
// bounded. Uses Upstash Redis over REST when configured; falls back to
// per-instance memory, which is best-effort on serverless.

export type QuotaKind = "trips" | "edits" | "ideas";

export interface LimitResult {
  allowed: boolean;
  reason?: "visitor" | "global";
  remaining: number;
}

export interface LimitConfig {
  perVisitor: number;
  global: number;
}

const DEFAULTS: Record<QuotaKind, LimitConfig> = {
  trips: { perVisitor: 3, global: 200 },
  edits: { perVisitor: 20, global: 1000 },
  ideas: { perVisitor: 5, global: 300 },
};

/** Env overrides: DAILY_TRIPS_PER_VISITOR, DAILY_EDITS_GLOBAL, etc. */
export function limitConfig(
  kind: QuotaKind,
  env: Record<string, string | undefined> = process.env,
): LimitConfig {
  const prefix = `DAILY_${kind.toUpperCase()}`;
  return {
    perVisitor: Number(env[`${prefix}_PER_VISITOR`]) || DEFAULTS[kind].perVisitor,
    global: Number(env[`${prefix}_GLOBAL`]) || DEFAULTS[kind].global,
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

/** Counts one AI call of the given kind and reports whether it is within quota. */
export async function consumeQuota(
  kind: QuotaKind,
  visitor: string,
  config: LimitConfig = limitConfig(kind),
  counter: Counter = defaultCounter(),
  now: Date = new Date(),
): Promise<LimitResult> {
  const day = dayKey(now);
  const ttl = 60 * 60 * 26;
  const visitorKey = `${kind}:${day}:v:${visitor}`;
  const globalKey = `${kind}:${day}:all`;
  let visitorCount: number;
  let globalCount: number;
  try {
    [visitorCount, globalCount] = await Promise.all([
      counter(visitorKey, ttl),
      counter(globalKey, ttl),
    ]);
  } catch (err) {
    // If the limiter store is down, fall back to memory rather than blocking everyone.
    console.error("Rate limiter unavailable, using memory", err);
    [visitorCount, globalCount] = await Promise.all([
      memoryCounter(visitorKey, ttl),
      memoryCounter(globalKey, ttl),
    ]);
  }
  if (globalCount > config.global) return { allowed: false, reason: "global", remaining: 0 };
  if (visitorCount > config.perVisitor) return { allowed: false, reason: "visitor", remaining: 0 };
  return { allowed: true, remaining: config.perVisitor - visitorCount };
}

const LIMIT_MESSAGES: Record<QuotaKind, string> = {
  trips: "trip plans",
  edits: "itinerary edits",
  ideas: "destination ideas",
};

/** A 429 response for a refused quota, or null when the call may proceed. */
export async function quotaGate(
  kind: QuotaKind,
  request: Request,
): Promise<{ denied: Response } | { remaining: number }> {
  const quota = await consumeQuota(kind, visitorId(request.headers));
  if (quota.allowed) return { remaining: quota.remaining };
  const error =
    quota.reason === "global"
      ? `TripMind has hit today's free limit for ${LIMIT_MESSAGES[kind]}. Please come back tomorrow.`
      : `You've used today's free ${LIMIT_MESSAGES[kind]}. Please come back tomorrow.`;
  return { denied: Response.json({ error }, { status: 429 }) };
}
