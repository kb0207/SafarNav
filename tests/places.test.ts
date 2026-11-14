import { it, expect, vi, afterEach } from "vitest";
import {
  normalizePlaces,
  getPlacesInfrastructure,
} from "@/lib/providers/places";
import { demoSnapshot } from "@/lib/providers/demo";
import { scoreRoute } from "@/lib/scoring/engine";
import { evaluate } from "@/lib/services";
import { summarize } from "@/lib/ai";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const feature = (categories: string[], raw: Record<string, unknown> = {}) => ({
  geometry: { type: "Point", coordinates: [77.219, 28.632] },
  properties: {
    place_id: "sample-id",
    name: "Sample POI",
    categories,
    datasource: { raw },
  },
});
it("preserves real tags and provenance without inventing schedules, roads or lights", () => {
  const [p] = normalizePlaces({
    features: [
      feature(["commercial.supermarket"], {
        opening_hours: "24/7",
        lit: "yes",
      }),
    ],
  });
  expect(p).toMatchObject({
    source: "geoapify",
    category: "business",
    tags: { opening_hours: "24/7" },
  });
  expect(p.tags).not.toHaveProperty("lit");
  expect(p).not.toHaveProperty("geometry");
  const [unknown] = normalizePlaces({
    features: [feature(["commercial.supermarket"])],
  });
  expect(unknown.tags.opening_hours).toBeUndefined();
});
it("separates pharmacies from hospitals and transport", () => {
  expect(
    normalizePlaces({ features: [feature(["healthcare.pharmacy"])] })[0]
      .category,
  ).toBe("business");
  expect(
    normalizePlaces({ features: [feature(["healthcare.hospital"])] })[0]
      .category,
  ).toBe("emergency");
  expect(
    normalizePlaces({ features: [feature(["public_transport.bus"])] })[0]
      .category,
  ).toBe("transport");
});
it("caps fallback requests and caches real responses", async () => {
  vi.stubEnv("GEOCODING_API_KEY", "test-key");
  const fetch = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ features: [feature(["commercial.supermarket"])] }),
        ),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const routes = demoSnapshot("walking").routes;
  const items = await getPlacesInfrastructure(routes);
  expect(items).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(3);
  const urls = fetch.mock.calls.map((c) => new URL(c[0]));
  expect(urls.map((u) => u.searchParams.get("limit"))).toEqual([
    "100",
    "100",
    "50",
  ]);
  await getPlacesInfrastructure(routes);
  expect(fetch).toHaveBeenCalledTimes(3);
});
it("keeps no-evidence indicators unavailable even in daylight and never recommends them", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  const snapshot = demoSnapshot("walking");
  snapshot.infrastructure = [];
  const data = evaluate(snapshot, "2026-11-14T12:00:00+05:30");
  expect(data.routes.every((r) => !r.hasInfrastructure)).toBe(true);
  expect(data.routes[0].duration).toBe(
    Math.min(...data.routes.map((r) => r.duration)),
  );
  const summary = await summarize(data);
  expect(summary.recommendedRouteId).toBeNull();
  expect(summary.headline).toBe("Your journey overview");
  const r = scoreRoute(
    snapshot.routes[0],
    [],
    "walking",
    "2026-11-14T23:00:00+05:30",
  );
  expect(r.hasInfrastructure).toBe(false);
});
