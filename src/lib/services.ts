import { inDelhiRegion } from "./geo/region";
import { distance } from "@turf/turf";
import { AppError, isDemo } from "./http";
import { demoSnapshot } from "./providers/demo";
import { getRoutes } from "./providers/routing";
import { loadInfrastructure } from "./providers/infrastructure";
import { scoreRoute, rankRoutes } from "./scoring/engine";
import { seal } from "./session";
import type { Place, Mode, Snapshot, RouteResponse } from "@/types";
export function evaluate(
  snapshot: Snapshot,
  departure: string,
  token?: string,
): RouteResponse {
  return {
    routes: rankRoutes(
      snapshot.routes.map((r) =>
        scoreRoute(r, snapshot.infrastructure, snapshot.mode, departure),
      ),
    ),
    token: token ?? seal(snapshot),
    departure,
    demo: snapshot.demo,
    fetchedAt: snapshot.fetchedAt,
    warnings: snapshot.warnings,
  };
}
export async function plan(input: {
  origin: Place;
  destination: Place;
  mode: Mode;
  departure: string;
}) {
  if (isDemo()) return evaluate(demoSnapshot(input.mode), input.departure);
  if (
    !inDelhiRegion(input.origin.coord) ||
    !inDelhiRegion(input.destination.coord)
  )
    throw new AppError(
      422,
      "Choose locations within Delhi and the adjoining NCR cities.",
    );
  const km = distance(input.origin.coord, input.destination.coord);
  if (km < 0.05 || km > 20)
    throw new AppError(
      422,
      "Choose different locations between 50 m and 20 km apart.",
    );
  const routes = await getRoutes(
    [input.origin.coord, input.destination.coord],
    input.mode,
  );
  let infrastructure: Snapshot["infrastructure"] = [];
  const warnings: string[] =
    routes.length < 3
      ? [
          `The routing provider returned ${routes.length} distinct feasible route${routes.length === 1 ? "" : "s"}. Up to three are requested; other roads may not qualify for this journey and travel mode.`,
        ]
      : [];
  try {
    const result = await loadInfrastructure(routes);
    infrastructure = result.infrastructure;
    warnings.push(...result.warnings);
  } catch (e) {
    warnings.push(
      e instanceof AppError
        ? e.message
        : "Infrastructure unavailable. Scores use uncertain neutral estimates.",
    );
  }
  if (!infrastructure.length)
    warnings.push(
      "Insufficient infrastructure data. Numerical estimates cannot establish which route is safer.",
    );
  const fetchedAt = infrastructure[0]?.fetchedAt ?? new Date().toISOString();
  return evaluate(
    { ...input, routes, infrastructure, demo: false, fetchedAt, warnings },
    input.departure,
  );
}
