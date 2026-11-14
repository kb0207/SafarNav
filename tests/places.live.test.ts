import { it, expect } from "vitest";
import { config } from "dotenv";
import { getPlacesInfrastructure } from "@/lib/providers/places";
import { scoreRoute } from "@/lib/scoring/engine";
import type { Route } from "@/types";
it.skipIf(process.env.CHECK_LIVE_PLACES !== "true")(
  "loads real fallback places using the existing configured key",
  async () => {
    config({ path: ".env.local", quiet: true });
    const route: Route = {
      id: "public-area-check",
      name: "Public-area check",
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
    const started = Date.now();
    const infrastructure = await getPlacesInfrastructure([route]);
    expect(infrastructure.length).toBeGreaterThan(0);
    expect(infrastructure.every((p) => p.source === "geoapify")).toBe(true);
    const r = scoreRoute(
      route,
      infrastructure,
      "walking",
      new Date().toISOString(),
    );
    expect(r.hasInfrastructure).toBe(true);
    console.info(
      JSON.stringify({
        elapsedMs: Date.now() - started,
        features: infrastructure.length,
        nearbyPOIs: r.pois.length,
        indicator: Math.round(r.score),
        confidence: Math.round(r.confidence),
        knownOpeningSchedules: infrastructure.filter(
          (p) => p.tags.opening_hours,
        ).length,
        source: "Geoapify places (OSM-derived)",
      }),
    );
  },
  25000,
);
