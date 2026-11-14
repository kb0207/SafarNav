import { z } from "zod";
import { bbox, featureCollection, lineString } from "@turf/turf";
import { AppError } from "@/lib/http";
import { requestOverpass } from "./overpass-client";
import { cache } from "@/lib/cache";
import { distanceTo } from "@/lib/geo";
import type { Category, Infrastructure, Route, Coord } from "@/types";
const node = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
const schema = z.object({
  elements: z
    .array(
      z.object({
        type: z.string(),
        id: z.number(),
        lat: z.number().optional(),
        lon: z.number().optional(),
        center: node.optional(),
        tags: z.record(z.string(), z.string()).optional(),
        geometry: z.array(node).optional(),
      }),
    )
    .max(30000),
  remark: z.string().optional(),
});
export function normalizeOSM(
  input: unknown,
  fetchedAt = new Date().toISOString(),
): Infrastructure[] {
  const data = schema.parse(input);
  if (data.remark)
    throw new AppError(
      502,
      "Infrastructure provider returned incomplete data.",
    );
  const result: Infrastructure[] = [];
  for (const e of data.elements) {
    const t = e.tags ?? {};
    const c =
      e.center ??
      (e.lat !== undefined && e.lon !== undefined
        ? { lat: e.lat, lon: e.lon }
        : e.geometry?.[0]);
    if (!c) continue;
    let category: Category | undefined;
    if (t.highway && t.highway !== "street_lamp" && t.highway !== "bus_stop")
      category = "road";
    else if (t.highway === "street_lamp") category = "lamp";
    else if (t.man_made === "surveillance") category = "surveillance";
    else if (["hospital", "clinic", "police", "fuel"].includes(t.amenity))
      category = "emergency";
    else if (t.amenity === "parking") category = "parking";
    else if (
      t.public_transport ||
      t.railway === "station" ||
      t.station === "subway" ||
      t.highway === "bus_stop"
    )
      category = "transport";
    else if (t.shop || ["pharmacy", "restaurant", "cafe"].includes(t.amenity))
      category = "business";
    if (!category) continue;
    result.push({
      id: `${e.type}/${e.id}`,
      name: t.name ?? `Mapped ${category}`,
      coord: [c.lon, c.lat],
      category,
      tags: t,
      source: "osm",
      fetchedAt,
      ...(e.geometry && e.geometry.length > 1
        ? {
            geometry: {
              type: "LineString" as const,
              coordinates: e.geometry.map((n) => [n.lon, n.lat]),
            },
          }
        : {}),
    });
  }
  return [...new Map(result.map((p) => [p.id, p])).values()];
}
export async function getInfrastructure(routes: Route[]) {
  const b = bbox(
    featureCollection(routes.map((r) => lineString(r.geometry.coordinates))),
  );
  const padLat = 0.0045,
    padLon =
      0.0045 / Math.max(0.2, Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180));
  const bounds = [
    b[1] - padLat,
    b[0] - padLon,
    b[3] + padLat,
    b[2] + padLon,
  ].map((v) => Number(v.toFixed(4)));
  if ((bounds[2] - bounds[0]) * (bounds[3] - bounds[1]) > 0.12)
    throw new AppError(
      422,
      "This journey covers too large an area. Try a shorter urban journey.",
    );
  const key = `osm:${bounds.join(",")}`;
  const hit = cache.get<Infrastructure[]>(key);
  if (hit) return hit;
  const box = bounds.join(",");
  const filters = [
    "[shop]",
    '[amenity~"^(pharmacy|restaurant|cafe|hospital|clinic|police|fuel|parking)$"]',
    "[railway=station]",
    "[public_transport]",
    '[highway~"^(bus_stop|street_lamp)$"]',
    "[man_made=surveillance]",
  ];
  // POI centers suffice for proximity. Only road ways need detailed geometry;
  // requesting geometry for all relations can pull in enormous transit networks.
  const query = `[out:json][timeout:18];(${filters.map((f) => `nwr${f}(${box});`).join("")});out center;way[highway](${box});out geom;`;
  const data = await requestOverpass(query);
  const normalized = normalizeOSM(data).filter((p) =>
    p.category === "road"
      ? p.geometry &&
        routes.some((r) =>
          p.geometry!.coordinates.some(
            (c) => distanceTo(c as Coord, r.geometry) < 450,
          ),
        )
      : routes.some((r) => distanceTo(p.coord, r.geometry) < 450),
  );
  if (normalized.length > 5000)
    throw new AppError(
      422,
      "Too much infrastructure in this area. Try a shorter journey.",
    );
  cache.set(key, normalized, 1800000);
  return normalized;
}
