import { z } from "zod";
import { bbox, featureCollection, lineString } from "@turf/turf";
import { AppError } from "@/lib/http";
import { cache } from "@/lib/cache";
import { distanceTo } from "@/lib/geo";
import type { Category, Coord, Infrastructure, Route } from "@/types";
const schema = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({
          type: z.literal("Point"),
          coordinates: z.tuple([
            z.number().min(-180).max(180),
            z.number().min(-85).max(85),
          ]),
        }),
        properties: z.object({
          place_id: z.string(),
          name: z.string().optional(),
          categories: z.array(z.string()),
          opening_hours: z.string().optional(),
          datasource: z
            .object({ raw: z.record(z.string(), z.unknown()).optional() })
            .optional(),
        }),
      }),
    )
    .max(100),
});
export function normalizePlaces(
  data: unknown,
  fetchedAt = new Date().toISOString(),
): Infrastructure[] {
  return schema.parse(data).features.map((f) => {
    const p = f.properties,
      c = p.categories;
    let category: Category = "business";
    if (
      c.some((x) =>
        /^(healthcare\.(hospital|clinic)|service\.(police|vehicle\.fuel))/.test(
          x,
        ),
      )
    )
      category = "emergency";
    else if (c.some((x) => x.startsWith("public_transport")))
      category = "transport";
    else if (c.some((x) => x.startsWith("parking"))) category = "parking";
    const raw = p.datasource?.raw ?? {};
    // Preserve only source-provided scalar tags. Never infer opening hours or lighting from categories.
    const tags: Record<string, string> = {};
    for (const name of [
      "opening_hours",
      "access",
      "motor_vehicle",
      "amenity",
      "shop",
    ]) {
      if (typeof raw[name] === "string") tags[name] = raw[name];
    }
    if (p.opening_hours) tags.opening_hours = p.opening_hours;
    return {
      id: `geoapify/${p.place_id}`,
      name: p.name ?? `Mapped ${category}`,
      coord: f.geometry.coordinates,
      category,
      tags,
      source: "geoapify" as const,
      fetchedAt,
    };
  });
}
export async function getPlacesInfrastructure(
  routes: Route[],
): Promise<Infrastructure[]> {
  const apiKey = process.env.GEOCODING_API_KEY?.trim();
  if (!apiKey)
    throw new AppError(
      503,
      "The backup place-data service is not configured.",
      "INFRASTRUCTURE_CONFIG",
    );
  const b = bbox(
    featureCollection(routes.map((r) => lineString(r.geometry.coordinates))),
  );
  const padLat = 0.0045,
    padLon =
      0.0045 / Math.max(0.2, Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180));
  // Round outward to coarse bounding coordinates; do not send the precise route or any identity.
  const bounds = [
    Math.floor((b[0] - padLon) * 1000) / 1000,
    Math.floor((b[1] - padLat) * 1000) / 1000,
    Math.ceil((b[2] + padLon) * 1000) / 1000,
    Math.ceil((b[3] + padLat) * 1000) / 1000,
  ];
  if ((bounds[2] - bounds[0]) * (bounds[3] - bounds[1]) > 0.12)
    throw new AppError(
      422,
      "This journey covers too large an area for infrastructure analysis.",
    );
  const key = `places:${bounds.join(",")}`;
  let points = cache.get<Infrastructure[]>(key);
  if (!points) {
    points = [];
    // Three bounded, sequential requests; at most 250 places / 13 Geoapify credits per cache miss.
    const groups = [
      { categories: "commercial,catering", limit: 100 },
      {
        categories:
          "healthcare.hospital,healthcare.clinic_or_praxis,healthcare.pharmacy,service.police,service.vehicle.fuel",
        limit: 100,
      },
      { categories: "public_transport", limit: 50 },
    ];
    for (const group of groups) {
      const url = new URL("https://api.geoapify.com/v2/places");
      url.search = new URLSearchParams({
        categories: group.categories,
        filter: `rect:${bounds.join(",")}`,
        limit: String(group.limit),
        apiKey,
      }).toString();
      let response: Response;
      try {
        response = await fetch(url, {
          signal: AbortSignal.timeout(6000),
          cache: "no-store",
        });
      } catch {
        throw new AppError(
          504,
          "The backup place-data service could not be reached.",
          "INFRASTRUCTURE_TIMEOUT",
        );
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new AppError(
          503,
          `The backup place-data service is unavailable (HTTP ${response.status}).`,
          "INFRASTRUCTURE_PROVIDER",
        );
      }
      try {
        points.push(...normalizePlaces(await response.json()));
      } catch {
        throw new AppError(
          502,
          "The backup place-data response could not be read.",
          "INFRASTRUCTURE_RESPONSE",
        );
      }
    }
    points = [...new Map(points.map((p) => [p.id, p])).values()];
    cache.set(key, points, 1800000);
  }
  return points.filter((p) =>
    routes.some((r) => distanceTo(p.coord as Coord, r.geometry) <= 450),
  );
}
