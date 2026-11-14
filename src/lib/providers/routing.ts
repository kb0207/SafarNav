import { z } from "zod";
import { providerFetch, AppError } from "@/lib/http";
import { coord } from "@/lib/validation";
import { deduplicate, routeLength } from "@/lib/geo";
import { cache } from "@/lib/cache";
import type { Coord, Mode, Route } from "@/types";
const response = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({
          type: z.literal("LineString"),
          coordinates: z.array(coord).min(2).max(20000),
        }),
        properties: z.object({
          summary: z.object({
            distance: z.number().positive().max(100000),
            duration: z.number().positive().max(172800),
          }),
        }),
      }),
    )
    .min(1)
    .max(5),
});
export function normalizeRoutes(data: unknown): Route[] {
  return deduplicate(
    response
      .parse(data)
      .features.map((f, i) => ({
        id: `route-${i}`,
        name: `Route ${String.fromCharCode(65 + i)}`,
        geometry: f.geometry,
        distance: f.properties.summary.distance,
        duration: f.properties.summary.duration,
      })),
  )
    .filter((r) => routeLength(r.geometry) > 10)
    .slice(0, 3);
}
export async function getRoutes(
  coords: Coord[],
  mode: Mode,
  alternatives = true,
) {
  if (!process.env.ORS_API_KEY)
    throw new AppError(
      503,
      "Add ORS_API_KEY or set DEMO_MODE=true.",
      "CONFIGURATION",
    );
  const key = JSON.stringify(["route", coords, mode, alternatives]);
  const cached = cache.get<Route[]>(key);
  if (cached) return cached;
  const data = await providerFetch(
    `${process.env.ORS_BASE_URL ?? "https://api.openrouteservice.org"}/v2/directions/${mode === "walking" ? "foot-walking" : "driving-car"}/geojson`,
    {
      method: "POST",
      headers: {
        Authorization: process.env.ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: coords,
        instructions: false,
        ...(alternatives
          ? {
              alternative_routes: {
                target_count: 3,
                share_factor: 0.85,
                weight_factor: 1.8,
              },
            }
          : {}),
      }),
    },
  );
  let result: Route[];
  try {
    result = normalizeRoutes(data);
  } catch {
    throw new AppError(
      502,
      "Routing provider returned no usable routes. Try nearby accessible locations.",
    );
  }
  if (!result.length) throw new AppError(422, "No feasible route found.");
  cache.set(key, result, 300000);
  return result;
}
