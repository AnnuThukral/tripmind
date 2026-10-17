import { describe, expect, it, vi } from "vitest";
import { consumeQuota, limitConfig, visitorId } from "./rate-limit";

function fakeCounter() {
  const counts = new Map<string, number>();
  return vi.fn(async (key: string) => {
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
  });
}

const now = new Date("2026-11-01T10:00:00Z");

describe("consumeQuota", () => {
  it("allows up to the per-visitor limit, then blocks", async () => {
    const counter = fakeCounter();
    const config = { perVisitor: 2, global: 100 };
    const results = [];
    for (let i = 0; i < 3; i++)
      results.push(await consumeQuota("trips", "1.2.3.4", config, counter, now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, false]);
    expect(results[0].remaining).toBe(1);
    expect(results[2].reason).toBe("visitor");
  });

  it("keeps visitors separate but shares the global cap", async () => {
    const counter = fakeCounter();
    const config = { perVisitor: 5, global: 2 };
    expect((await consumeQuota("trips", "a", config, counter, now)).allowed).toBe(true);
    expect((await consumeQuota("trips", "b", config, counter, now)).allowed).toBe(true);
    const third = await consumeQuota("trips", "c", config, counter, now);
    expect(third).toEqual({ allowed: false, reason: "global", remaining: 0 });
  });

  it("resets on a new UTC day", async () => {
    const counter = fakeCounter();
    const config = { perVisitor: 1, global: 100 };
    await consumeQuota("trips", "a", config, counter, now);
    expect((await consumeQuota("trips", "a", config, counter, now)).allowed).toBe(false);
    const tomorrow = new Date("2026-11-02T00:01:00Z");
    expect((await consumeQuota("trips", "a", config, counter, tomorrow)).allowed).toBe(true);
  });

  it("falls back to memory when the store errors", async () => {
    const broken = vi.fn().mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await consumeQuota("trips", "x", { perVisitor: 3, global: 10 }, broken, now);
    expect(result.allowed).toBe(true);
  });
});

describe("visitorId", () => {
  it("uses the first x-forwarded-for address", () => {
    expect(visitorId(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(visitorId(new Headers())).toBe("unknown");
  });
});

describe("limitConfig", () => {
  it("reads limits from env with defaults", () => {
    expect(limitConfig("trips", {})).toEqual({ perVisitor: 3, global: 200 });
    expect(limitConfig("edits", {})).toEqual({ perVisitor: 20, global: 1000 });
    expect(
      limitConfig("trips", { DAILY_TRIPS_PER_VISITOR: "5", DAILY_TRIPS_GLOBAL: "50" }),
    ).toEqual({
      perVisitor: 5,
      global: 50,
    });
  });
});

describe("quota kinds", () => {
  it("counts each kind separately", async () => {
    const counter = fakeCounter();
    const config = { perVisitor: 1, global: 100 };
    expect((await consumeQuota("trips", "a", config, counter, now)).allowed).toBe(true);
    expect((await consumeQuota("edits", "a", config, counter, now)).allowed).toBe(true);
    expect((await consumeQuota("trips", "a", config, counter, now)).allowed).toBe(false);
  });
});
