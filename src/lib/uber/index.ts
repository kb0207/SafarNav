import { locate, overlap } from "@/lib/geo";
import { getRoutes } from "@/lib/providers/routing";
import { AppError } from "@/lib/http";
import type { Place, Snapshot, Route, Infrastructure } from "@/types";
export function uberLink(origin: Place, destination: Place) {
  const url = new URL("https://m.uber.com/ul/");
  url.searchParams.set("action", "setPickup");
  if (process.env.UBER_CLIENT_ID)
    url.searchParams.set("client_id", process.env.UBER_CLIENT_ID);
  for (const [prefix, p] of [
    ["pickup", origin],
    ["dropoff", destination],
  ] as const) {
    url.searchParams.set(`${prefix}[latitude]`, String(p.coord[1]));
    url.searchParams.set(`${prefix}[longitude]`, String(p.coord[0]));
    url.searchParams.set(`${prefix}[nickname]`, p.name);
  }
  return url.toString();
}
export function candidates(snapshot: Snapshot, route: Route) {
  return snapshot.infrastructure
    .filter(
      (p) =>
        p.category === "parking" &&
        p.tags.access !== "private" &&
        p.tags.access !== "no" &&
        p.tags.motor_vehicle !== "no",
    )
    .map((p) => ({ p, pos: locate(p.coord, route.geometry) }))
    .filter(
      ({ pos }) =>
        pos.distance < 50 &&
        pos.along > route.distance * 0.2 &&
        pos.along < route.distance * 0.8,
    )
    .sort((a, b) => {
      const distinction = (p: Infrastructure) =>
        Math.min(
          ...snapshot.routes
            .filter((r) => r.id !== route.id)
            .map((r) => locate(p.coord, r.geometry).distance),
          1000,
        );
      return (
        distinction(b.p) - distinction(a.p) || a.p.id.localeCompare(b.p.id)
      );
    })
    .slice(0, 3)
    .map((x) => x.p);
}
export async function preview(
  snapshot: Snapshot,
  routeId: string,
  stopId?: string,
  consent = false,
) {
  if (snapshot.mode !== "driving")
    throw new AppError(400, "Uber handoff requires Driving mode.");
  const route = snapshot.routes.find((r) => r.id === routeId);
  if (!route) throw new AppError(404, "Route not found.");
  const options = candidates(snapshot, route);
  let stop: Infrastructure | undefined;
  let extraSeconds = 0;
  let verified = false;
  if (stopId) {
    if (!consent)
      throw new AppError(400, "Consent is required for an intermediate stop.");
    stop = options.find((p) => p.id === stopId);
    if (!stop)
      throw new AppError(
        400,
        "Stop is not an eligible public parking candidate.",
      );
    if (!snapshot.demo) {
      const routed = (
        await getRoutes(
          [snapshot.origin.coord, stop.coord, snapshot.destination.coord],
          "driving",
          false,
        )
      )[0];
      const snappedDistance = locate(stop.coord, routed.geometry).distance;
      if (
        snappedDistance > 40 ||
        overlap(route, routed) < 0.8 ||
        routed.distance > route.distance * 1.2
      )
        throw new AppError(
          422,
          "This stop could not be verified on the selected route. Continue without it.",
        );
      extraSeconds = Math.max(0, routed.duration - route.duration);
      verified = true;
    }
  }
  return {
    origin: snapshot.origin,
    destination: snapshot.destination,
    routeId,
    options: options.map((p) => ({ id: p.id, name: p.name, coord: p.coord })),
    stop: stop ? { id: stop.id, name: stop.name, coord: stop.coord } : null,
    verified,
    extraSeconds,
    distance: route.distance,
    duration: route.duration,
    url: uberLink(snapshot.origin, snapshot.destination),
    manualStopRequired: !!stop,
    multiStopSupported: false,
    demo: snapshot.demo,
    notice:
      "The official documented link prefills pickup and destination only. Add any reviewed stop manually in Uber before booking. Uber controls routing and fare; a stop cannot enforce this route.",
  };
}
export type UberPreview = Awaited<ReturnType<typeof preview>>;
