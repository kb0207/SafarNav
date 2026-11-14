import { afterEach, describe, it, expect, vi } from "vitest";
import { normalizeRoutes, getRoutes } from "@/lib/providers/routing";
import { normalizeOSM } from "@/lib/providers/overpass";
import { geocode } from "@/lib/providers/geocoding";
import { MemoryCache } from "@/lib/cache";
import { seal, unseal } from "@/lib/session";
import { demoSnapshot } from "@/lib/providers/demo";
import { evaluate } from "@/lib/services";
import { summarize } from "@/lib/ai";
import { uberLink, candidates, preview } from "@/lib/uber";
import { body, guard, limit } from "@/lib/http";
import { feedback, journey } from "@/lib/validation";
import { saveFeedback } from "@/lib/db";
import { trackingState } from "@/lib/geo/tracking";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("providers and security", () => {
  it("normalizes and deduplicates provider routes", () => {
    const feature = {
      geometry: {
        type: "LineString",
        coordinates: [
          [77, 28],
          [77.01, 28],
        ],
      },
      properties: { summary: { distance: 1000, duration: 600 } },
    };
    expect(normalizeRoutes({ features: [feature, feature] })).toHaveLength(1);
  });
  it("rejects invalid provider geometries", () =>
    expect(() =>
      normalizeRoutes({
        features: [
          { geometry: { type: "LineString", coordinates: [[900, 28]] } },
        ],
      }),
    ).toThrow());
  it("does not invent infeasible routes", async () => {
    vi.stubEnv("ORS_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ features: [] }))),
    );
    await expect(
      getRoutes(
        [
          [1, 1],
          [2, 2],
        ],
        "walking",
      ),
    ).rejects.toThrow(/no usable routes/);
  });
  it("extracts OSM IDs, schedules and road geometries", () => {
    const items = normalizeOSM({
      elements: [
        {
          type: "node",
          id: 1,
          lat: 28,
          lon: 77,
          tags: { shop: "yes", opening_hours: "24/7" },
        },
        {
          type: "way",
          id: 2,
          center: { lat: 28, lon: 77 },
          tags: { highway: "residential", lit: "yes" },
          geometry: [
            { lat: 28, lon: 77 },
            { lat: 28.01, lon: 77 },
          ],
        },
      ],
    });
    expect(items[0]).toMatchObject({
      id: "node/1",
      category: "business",
      source: "osm",
    });
    expect(items[1].geometry?.coordinates).toHaveLength(2);
  });
  it("rejects partial Overpass results", () =>
    expect(() =>
      normalizeOSM({ elements: [], remark: "runtime error" }),
    ).toThrow());
  it("surfaces geocoding provider failures", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("GEOCODING_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );
    await expect(geocode("unavailable-place")).rejects.toThrow(/429/);
  });
  it("expires cached values", () => {
    vi.useFakeTimers();
    const c = new MemoryCache();
    c.set("x", 42, 100);
    expect(c.get("x")).toBe(42);
    vi.advanceTimersByTime(101);
    expect(c.get("x")).toBeUndefined();
  });
  it("rejects tampered and expired session snapshots", () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.useFakeTimers();
    const token = seal(demoSnapshot("walking"));
    expect(unseal(token).mode).toBe("walking");
    expect(() => unseal(token.slice(0, -20) + "fake")).toThrow(/invalid/);
    vi.advanceTimersByTime(3600001);
    expect(() => unseal(token)).toThrow(/expired/);
  });
  it("rescoring reuses geometry and never calls the provider", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const s = demoSnapshot("walking");
    const morning = evaluate(s, "2026-11-14T09:00:00+05:30");
    const evening = evaluate(s, "2026-11-14T23:45:00+05:30", morning.token);
    expect(evening.token).toBe(morning.token);
    expect(evening.routes.find((r) => r.id === "demo-0")?.score).not.toBe(
      morning.routes.find((r) => r.id === "demo-0")?.score,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("falls back without Gemini and does not change scores", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const data = evaluate(demoSnapshot("walking"), new Date().toISOString());
    const scores = data.routes.map((r) => r.score);
    expect((await summarize(data)).source).toBe("template");
    expect(data.routes.map((r) => r.score)).toEqual(scores);
  });
  it("preserves pickup and final destination without pretending to support stops", () => {
    const s = demoSnapshot("driving");
    const u = new URL(uberLink(s.origin, s.destination));
    expect(u.searchParams.get("pickup[longitude]")).toBe(
      String(s.origin.coord[0]),
    );
    expect(u.searchParams.get("dropoff[latitude]")).toBe(
      String(s.destination.coord[1]),
    );
    expect(u.searchParams.has("drop[0]")).toBe(false);
  });
  it("rejects walking handoffs, invalid and non-consensual stops", async () => {
    await expect(preview(demoSnapshot("walking"), "demo-0")).rejects.toThrow(
      /Driving/,
    );
    const s = demoSnapshot("driving");
    await expect(preview(s, "demo-0", "fake", true)).rejects.toThrow(
      /eligible/,
    );
    const options = candidates(s, s.routes[0]);
    expect(options.length).toBeGreaterThan(0);
    await expect(preview(s, "demo-0", options[0].id, false)).rejects.toThrow(
      /Consent/,
    );
    const p = await preview(s, "demo-0", options[0].id, true);
    expect(p.manualStopRequired).toBe(true);
    expect(p.multiStopSupported).toBe(false);
  });
  it("requires a valid session and never persists demo feedback", async () => {
    const token = seal(demoSnapshot("walking"));
    const input = feedback.parse({
      token,
      routeId: "demo-0",
      rating: 4,
      lighting: "most",
      activity: "busy",
      concern: "no",
      comments: "<hello>",
      submissionId: crypto.randomUUID(),
    });
    expect(input.comments).toBe("hello");
    expect(await saveFeedback(input)).toMatchObject({
      saved: false,
      demo: true,
    });
    expect(feedback.safeParse({ ...input, rating: 6 }).success).toBe(false);
  });
  it("accepts the incoming same-origin Host behind Next.js URL normalization", async () => {
    await expect(
      guard(
        new Request("http://localhost:3000/api/routes", {
          headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
        }),
      ),
    ).resolves.toBeUndefined();
  });
  it("blocks cross-origin submissions and rate abuse", async () => {
    await expect(
      guard(
        new Request("https://example.com/api/routes", {
          headers: { Origin: "https://attacker.com" },
        }),
      ),
    ).rejects.toThrow(/Cross-origin/);
    const key = crypto.randomUUID();
    limit(key, 1);
    expect(() => limit(key, 1)).toThrow(/Too many/);
  });
  it("rejects oversized requests and invalid coordinates", async () => {
    const req = new Request("http://localhost/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(2_000_001),
    });
    await expect(body(req, journey)).rejects.toThrow(/too large/);
    expect(
      journey.safeParse({ origin: { name: "x", coord: [999, 1] } }).success,
    ).toBe(false);
  });
  it("ignores weak-section alerts when GPS accuracy is poor", () => {
    const data = evaluate(demoSnapshot("walking"), "2026-11-14T23:45:00+05:30");
    const r = data.routes.find((r) => r.id === "demo-2")!;
    const s = trackingState(
      r,
      r.geometry.coordinates[0] as [number, number],
      200,
    );
    expect(s.upcoming).toBeUndefined();
  });
});
