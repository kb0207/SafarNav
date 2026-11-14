import { along, lineString } from "@turf/turf";
import { distanceTo, routeLength } from "@/lib/geo";
import type { Coord, Mode, Place, Route } from "@/types";
export function googleMapsHandoff(
  route: Route,
  alternatives: Route[],
  origin: Place,
  destination: Place,
  mode: Mode,
) {
  const total = routeLength(route.geometry);
  const others = alternatives.filter((r) => r.id !== route.id);
  // Pick an interior point furthest from alternatives, not an invented POI.
  const samples = Array.from({ length: 13 }, (_, i) => {
    const fraction = 0.2 + i * 0.05;
    const coord = along(
      lineString(route.geometry.coordinates),
      total * fraction,
      { units: "meters" },
    ).geometry.coordinates as Coord;
    const separation = others.length
      ? Math.min(...others.map((r) => distanceTo(coord, r.geometry)))
      : 0;
    return { coord, separation, fraction };
  }).sort(
    (a, b) =>
      b.separation - a.separation ||
      Math.abs(a.fraction - 0.5) - Math.abs(b.fraction - 0.5),
  );
  const waypoint = samples[0].coord;
  const format = (c: Coord) => `${c[1].toFixed(6)},${c[0].toFixed(6)}`;
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({
    api: "1",
    origin: format(origin.coord),
    destination: format(destination.coord),
    travelmode: mode,
    waypoints: format(waypoint),
  }).toString();
  return { url: url.toString(), waypoint };
}
