import {
  lineString,
  point,
  nearestPointOnLine,
  lineSliceAlong,
  length,
  pointToLineDistance,
} from "@turf/turf";
import type { Coord, Route } from "@/types";
import type { LineString } from "geojson";
export function routeLength(geometry: LineString) {
  return length(lineString(geometry.coordinates), { units: "meters" });
}
export function locate(coord: Coord, geometry: LineString) {
  const p = nearestPointOnLine(geometry, point(coord), { units: "meters" });
  return {
    distance: p.properties.dist,
    along: p.properties.location,
    coord: p.geometry.coordinates as Coord,
  };
}
export function slice(geometry: LineString, start: number, end: number) {
  return lineSliceAlong(geometry, start, end, { units: "meters" }).geometry;
}
export function distanceTo(coord: Coord, geometry: LineString) {
  return pointToLineDistance(point(coord), lineString(geometry.coordinates), {
    units: "meters",
  });
}
export function overlap(a: Route, b: Route) {
  let near = 0,
    total = 0;
  const len = routeLength(a.geometry);
  for (let d = 0; d < len; d += 100) {
    const coord = slice(a.geometry, d, Math.min(d + 1, len))
      .coordinates[0] as Coord;
    total++;
    if (distanceTo(coord, b.geometry) < 45) near++;
  }
  return near / Math.max(1, total);
}
export function deduplicate(routes: Route[]) {
  return routes.filter(
    (r, i) =>
      !routes
        .slice(0, i)
        .some((other) => overlap(r, other) > 0.97 && overlap(other, r) > 0.97),
  );
}
