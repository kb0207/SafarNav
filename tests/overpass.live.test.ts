import { it, expect } from "vitest";
import { getInfrastructure } from "@/lib/providers/overpass";
import { scoreRoute } from "@/lib/scoring/engine";
import type { Route } from "@/types";
// Opt-in smoke check: a fixed public area, no user locations, API keys or database.
it.skipIf(process.env.CHECK_LIVE_OVERPASS !== "true")(
  "loads real OSM infrastructure and feeds the scoring engine",
  async () => {
    const route: Route = {
      id: "live-check",
      name: "Public-area infrastructure smoke check",
      geometry: {
        type: "LineString",
        coordinates: [
          [77.2195, 28.6328],
          [77.2176, 28.6301],
          [77.2186, 28.6257],
        ],
      },
      distance: 1000,
      duration: 900,
    };
    const infrastructure = await getInfrastructure([route]);
    expect(infrastructure.length).toBeGreaterThan(0);
    expect(infrastructure.every((p) => p.source === "osm")).toBe(true);
    const result = scoreRoute(
      route,
      infrastructure,
      "walking",
      new Date().toISOString(),
    );
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.segments.some((s) => s.factors.road.known)).toBe(true);
    console.info(
      JSON.stringify({
        infrastructureFeatures: infrastructure.length,
        nearbyPOIs: result.pois.length,
        indicator: Math.round(result.score),
        confidence: Math.round(result.confidence),
        source: "OpenStreetMap",
      }),
    );
  },
  30000,
);
