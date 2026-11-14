import { locate, routeLength } from "@/lib/geo";
import type { Coord, ScoredRoute } from "@/types";
export function trackingState(
  route: ScoredRoute,
  coord: Coord,
  accuracy: number,
) {
  const position = locate(coord, route.geometry);
  const total = routeLength(route.geometry);
  const remaining = Math.max(0, total - position.along);
  const offRoute = position.distance > Math.max(60, accuracy * 2);
  const upcoming =
    accuracy < 100 && !offRoute
      ? route.segments.find(
          (s) =>
            s.score < 30 &&
            s.start >= position.along &&
            s.start - position.along < 250,
        )
      : undefined;
  return {
    remaining,
    progress: Math.min(100, (position.along / total) * 100),
    seconds: (route.duration * remaining) / total,
    offRoute,
    upcoming,
  };
}
