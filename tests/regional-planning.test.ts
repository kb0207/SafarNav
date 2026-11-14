import { afterEach, expect, it, vi } from "vitest";
import { geocode } from "@/lib/providers/geocoding";
import { getRoutes, normalizeRoutes } from "@/lib/providers/routing";
import { DELHI_FILTER, inDelhiRegion } from "@/lib/geo/region";
import { scoreRoute, evidenceScore } from "@/lib/scoring/engine";
import type { Factor, Infrastructure, Route } from "@/types";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const feature = (name: string, lon: number, lat: number) => ({
  properties: { formatted: name, lon, lat },
});
it("limits search to Delhi/NCR, expands aliases, merges landmark fallback and caches results", async () => {
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("GEOCODING_API_KEY", "test");
  const fetch = vi
    .fn()
    .mockImplementation(
      async (url: string) =>
        new Response(
          JSON.stringify({
            features: url.includes("/search?")
              ? [
                  feature("DTU", 77.117, 28.75),
                  feature("Elsewhere", 72.8, 19.1),
                ]
              : [feature("DTU", 77.117, 28.75)],
          }),
        ),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await geocode("DTU")).toEqual([
    { name: "DTU", coord: [77.117, 28.75] },
  ]);
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [url] of fetch.mock.calls) {
    const params = new URL(url).searchParams;
    expect(params.get("filter")).toBe(DELHI_FILTER);
    expect(params.get("text")).toBe("Delhi Technological University");
  }
  await geocode(" dtu ");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(inDelhiRegion([77.03, 28.46])).toBe(true);
  expect(inDelhiRegion([77.39, 28.54])).toBe(true);
  expect(inDelhiRegion([72.8, 19.1])).toBe(false);
});
const routes = [0, 1, 2].map((n) => ({
  geometry: {
    type: "LineString",
    coordinates: [
      [77.2, 28.6],
      [77.205, 28.6 + n * 0.005],
      [77.21, 28.6],
    ],
  },
  properties: {
    summary: { distance: 1000 + n * 300, duration: 600 + n * 100 },
  },
}));
it("retains three genuine alternatives and requests a less restrictive overlap limit", async () => {
  vi.stubEnv("ORS_API_KEY", "test");
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ features: routes })));
  vi.stubGlobal("fetch", fetch);
  expect(
    await getRoutes(
      [
        [77.2, 28.6],
        [77.21, 28.6],
      ],
      "walking",
    ),
  ).toHaveLength(3);
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.alternative_routes).toMatchObject({
    target_count: 3,
    share_factor: 0.85,
    weight_factor: 1.8,
  });
  expect(normalizeRoutes({ features: [routes[0], routes[0]] })).toHaveLength(1);
});
const route: Route = {
  id: "camera-route",
  name: "Camera route",
  geometry: {
    type: "LineString",
    coordinates: [
      [77.2, 28.6],
      [77.212, 28.6],
    ],
  },
  distance: 1170,
  duration: 900,
};
const camera = (id: string, lon: number): Infrastructure => ({
  id,
  name: id,
  coord: [lon, 28.6],
  category: "surveillance",
  tags: { "surveillance:type": "camera" },
  source: "osm",
  fetchedAt: new Date().toISOString(),
});
it("counts cameras uniquely and rewards distribution instead of clusters or route length", () => {
  const at = "2026-11-15T23:00:00+05:30";
  const clustered = scoreRoute(
    route,
    [camera("a", 77.206), camera("b", 77.2061), camera("c", 77.2062)],
    "walking",
    at,
  );
  const spread = scoreRoute(
    route,
    [camera("a", 77.202), camera("b", 77.206), camera("c", 77.21)],
    "walking",
    at,
  );
  expect(spread.cameras.count).toBe(3);
  expect(spread.cameras.nearbyPercent).toBeGreaterThan(
    clustered.cameras.nearbyPercent,
  );
  expect(spread.cameras.largestGap).toBeLessThan(clustered.cameras.largestGap);
  expect(spread.score).toBeGreaterThan(clustered.score);
  const guard = {
    ...camera("guard", 77.206),
    tags: { "surveillance:type": "guard" },
  };
  const unknown = { ...camera("unknown", 77.206), tags: {} };
  expect(scoreRoute(route, [guard, unknown], "walking", at).cameras.count).toBe(
    0,
  );
});
it("keeps sparse scores conservative while separating genuinely different evidence", () => {
  const f = (score: number, known = true): Factor => ({
    score,
    known,
    weight: 10,
    evidence: "fixture",
  });
  expect(evidenceScore([f(90, false)])).toBe(50);
  expect(evidenceScore([f(90)])).toBeLessThan(70);
  expect(evidenceScore([f(90)]) - evidenceScore([f(10)])).toBeGreaterThan(8);
  expect(evidenceScore([f(90), f(0, false)])).toBe(evidenceScore([f(90)]));
});
