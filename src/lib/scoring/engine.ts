import { cameraMetrics, isCamera } from "./cameras";
import { along, lineString } from "@turf/turf";
import SunCalc from "suncalc";
import { locate, routeLength, slice, distanceTo } from "@/lib/geo";
import { openingStatus } from "./hours";
import {
  weights,
  radius,
  saturation,
  clamp,
  WEAK_THRESHOLD,
  scoringPolicy,
} from "./config";
import type {
  Coord,
  Infrastructure,
  Route,
  Mode,
  Segment,
  Factor,
  FactorName,
  ScoredRoute,
  EvaluatedPOI,
} from "@/types";
// Missing evidence never counts as an observed failure. Known weaknesses
// receive a penalty; sparse evidence limits how high a score can be.
export function evidenceScore(factors: Factor[]) {
  const known = factors.filter((f) => f.known && f.weight > 0);
  const weight = known.reduce((sum, f) => sum + f.weight, 0);
  if (!weight) return 50; // Internal placeholder; unavailable scores are hidden.
  const mean = known.reduce((sum, f) => sum + f.score * f.weight, 0) / weight;
  const deficit =
    known.reduce(
      (sum, f) =>
        sum + Math.max(0, scoringPolicy.downsideThreshold - f.score) * f.weight,
      0,
    ) / weight;
  const ceiling =
    scoringPolicy.sparseEvidenceCeiling +
    ((100 - scoringPolicy.sparseEvidenceCeiling) * Math.min(100, weight)) / 100;
  return clamp(
    Math.min(ceiling, mean - scoringPolicy.downsidePenalty * deficit),
  );
}
export function aggregateScore(
  segments: Pick<Segment, "score" | "length" | "confidence">[],
) {
  const observed = segments.filter((s) => s.confidence > 0);
  if (!observed.length) return 50;
  const confidence = weightedMean(
    segments.map((s) => ({ score: s.confidence, length: s.length })),
  );
  const budget =
    observed.reduce((sum, s) => sum + s.length, 0) *
    scoringPolicy.weakestFraction;
  let remaining = budget,
    weightedTail = 0;
  for (const s of [...observed].sort((a, b) => a.score - b.score)) {
    const length = Math.min(remaining, s.length);
    weightedTail += length * s.score;
    remaining -= length;
    if (remaining <= 0) break;
  }
  const tail = budget ? weightedTail / budget : weightedMean(observed);
  return clamp(
    Math.min(
      (1 - scoringPolicy.weakestBlend) * weightedMean(observed) +
        scoringPolicy.weakestBlend * tail,
      scoringPolicy.sparseEvidenceCeiling +
        ((100 - scoringPolicy.sparseEvidenceCeiling) * confidence) / 100,
    ),
  );
}
export function weightedMean(items: { score: number; length: number }[]) {
  const total = items.reduce((s, x) => s + x.length, 0);
  return total ? items.reduce((s, x) => s + x.score * x.length, 0) / total : 50;
}
export function weakMetrics(segments: Pick<Segment, "score" | "length">[]) {
  let weakLength = 0,
    longestWeak = 0,
    run = 0,
    weakCount = 0;
  for (const s of segments) {
    if (s.score < WEAK_THRESHOLD) {
      weakCount++;
      weakLength += s.length;
      run += s.length;
      longestWeak = Math.max(longestWeak, run);
    } else run = 0;
  }
  return { weakLength, longestWeak, weakCount };
}
export function scoreRoute(
  route: Route,
  infrastructure: Infrastructure[],
  mode: Mode,
  departure: string,
): ScoredRoute {
  const total = routeLength(route.geometry);
  const start = new Date(departure).getTime();
  const pois: EvaluatedPOI[] = infrastructure
    .filter((p) => p.category !== "road")
    .map((p) => {
      const pos = locate(p.coord, route.geometry);
      const passingTime = new Date(
        start + route.duration * 1000 * Math.min(1, pos.along / total),
      ).toISOString();
      return {
        ...p,
        distanceToRoute: pos.distance,
        along: pos.along,
        passingTime,
        status: openingStatus(
          p.tags.opening_hours,
          new Date(passingTime),
          p.coord,
        ),
      };
    })
    .filter((p) => p.distanceToRoute <= radius(p.category, mode));
  const roads = infrastructure.filter(
    (p) => p.category === "road" && p.geometry,
  );
  const segments: Segment[] = [];
  // At most 500 segments: 150 m ordinarily, coarser for longer allowed routes.
  const size = Math.max(150, total / 500);
  for (let d = 0; d < total; d += size) {
    const end = Math.min(total, d + size),
      geometry = slice(route.geometry, d, end);
    const mid = along(lineString(geometry.coordinates), (end - d) / 2, {
      units: "meters",
    }).geometry.coordinates as Coord;
    const local = pois.filter(
      (p) =>
        p.along >= d - radius(p.category, mode) &&
        p.along <= end + radius(p.category, mode) &&
        distanceTo(p.coord, geometry) <= radius(p.category, mode),
    );
    const businesses = local.filter((p) => p.category === "business");
    const unique = new Map(
      businesses.map((p) => [
        `${p.coord[0].toFixed(4)},${p.coord[1].toFixed(4)}`,
        p,
      ]),
    );
    const open = [...unique.values()].filter((p) => p.status === "open").length;
    const known = businesses.filter((p) => p.status !== "unknown").length;
    const road = roads
      .map((r) => ({ r, dist: distanceTo(mid, r.geometry!) }))
      .filter((r) => r.dist < 25)
      .sort((a, b) => a.dist - b.dist)[0]?.r;
    const tags = road?.tags ?? {};
    const at = new Date(
      start + route.duration * 1000 * ((d + end) / 2 / total),
    );
    const daylight = SunCalc.getPosition(at, mid[1], mid[0]).altitude > -0.0145;
    const lit = tags.lit === "yes" || local.some((p) => p.category === "lamp");
    const unlit = tags.lit === "no" && !lit;
    const restricted =
      tags.access === "private" ||
      tags.access === "no" ||
      tags[mode === "walking" ? "foot" : "motor_vehicle"] === "no";
    const roadKnown = !!tags.highway;
    const pedestrian = ["footway", "pedestrian", "path", "steps"].includes(
      tags.highway,
    );
    const heavy = ["motorway", "trunk"].includes(tags.highway);
    const roadScore = restricted
      ? 0
      : mode === "walking"
        ? heavy
          ? 15
          : pedestrian
            ? 90
            : tags.highway === "residential"
              ? 70
              : 55
        : pedestrian
          ? 0
          : heavy
            ? 65
            : tags.highway === "residential"
              ? 75
              : 70;
    const suitable = restricted
      ? 0
      : mode === "walking"
        ? heavy
          ? 5
          : pedestrian
            ? 90
            : tags.sidewalk && tags.sidewalk !== "no"
              ? 85
              : tags.sidewalk === "no"
                ? 25
                : 50
        : pedestrian
          ? 0
          : roadKnown
            ? 85
            : 50;
    const f = (
      score: number,
      known: boolean,
      evidence: string,
      name: FactorName,
    ): Factor => ({
      score: clamp(score),
      known,
      evidence,
      weight: weights[mode][name],
    });
    const support = local.filter((p) => p.category === "emergency");
    const cameras = local.filter(isCamera);
    const factors: Record<FactorName, Factor> = {
      activity: f(
        businesses.length ? (known ? saturation(open) : 50) : 50,
        known > 0,
        `${open} expected-open businesses; ${businesses.length - known} unknown schedules. Presence is not a crowd measurement.`,
        "activity",
      ),
      lighting: f(
        daylight ? 90 : lit ? 90 : unlit ? 10 : 50,
        daylight || lit || unlit,
        daylight
          ? "Daylight estimated from sun position"
          : lit
            ? "Mapped lighting; operation unverified"
            : unlit
              ? "Explicit lit=no tag"
              : "Limited lighting data; neutral estimate",
        "lighting",
      ),
      road: f(
        roadKnown ? roadScore : 50,
        roadKnown,
        roadKnown
          ? `Nearby ${tags.highway} road; proximity match only`
          : "Road class unavailable",
        "road",
      ),
      isolation: f(
        known ? (open ? Math.max(30, saturation(open)) : 20) : 50,
        known > 0,
        known && !open
          ? "Potentially isolated stretch: no expected-open businesses in mapped sample"
          : "Activity proximity proxy; mapping may be incomplete",
        "isolation",
      ),
      emergency: f(
        support.length ? Math.min(90, 60 + support.length * 10) : 50,
        support.length > 0,
        `${support.length} mapped support facilities nearby; access and staffing unverified`,
        "emergency",
      ),
      transport: f(
        local.some((p) => p.category === "transport") ? 75 : 50,
        local.some((p) => p.category === "transport"),
        "Mapped transit proximity only; service hours unverified",
        "transport",
      ),
      surveillance: f(
        cameras.length ? 50 + 40 * (1 - Math.exp(-cameras.length / 2)) : 50,
        cameras.length > 0,
        `${cameras.length} explicitly mapped cameras within 60 m of this section; viewing direction and operation unverified`,
        "surveillance",
      ),
      suitability: f(
        suitable,
        roadKnown &&
          (mode === "driving" || restricted || pedestrian || !!tags.sidewalk),
        restricted
          ? "Nearby road has restricted access; map matching uncertain"
          : `Mode suitability from mapped access and road tags`,
        "suitability",
      ),
    };
    let score = evidenceScore(Object.values(factors));
    // A mode-incompatible road must not be rescued by shops or cameras.
    if (factors.suitability.known && factors.suitability.score <= 10)
      score = Math.min(score, scoringPolicy.criticalSuitabilityCeiling);
    const confidence = Object.values(factors).reduce(
      (s, f) => s + (f.known ? f.weight : 0),
      0,
    );
    segments.push({
      id: `${route.id}-${segments.length}`,
      geometry,
      start: d,
      length: end - d,
      score,
      confidence,
      factors,
    });
  }
  const factors = Object.fromEntries(
    (Object.keys(weights[mode]) as FactorName[]).map((key) => [
      key,
      {
        score: weightedMean(
          segments.map((s) => ({
            score: s.factors[key].score,
            length: s.length,
          })),
        ),
        weight: weights[mode][key],
        known: segments.some((s) => s.factors[key].known),
        evidence: `Distance-weighted ${key} contribution; inspect sections for evidence.`,
      },
    ]),
  ) as Record<FactorName, Factor>;
  return {
    ...route,
    cameras: cameraMetrics(pois, total, mode),
    hasInfrastructure:
      segments.some((s) =>
        Object.entries(s.factors).some(
          ([name, f]) => name !== "lighting" && f.known,
        ),
      ) ||
      pois.some((p) => p.category === "lamp") ||
      roads.some((r) => ["yes", "no"].includes(r.tags.lit)),
    score: aggregateScore(segments),
    confidence: weightedMean(
      segments.map((s) => ({ score: s.confidence, length: s.length })),
    ),
    lowest: Math.min(...segments.map((s) => s.score)),
    ...weakMetrics(segments),
    segments,
    pois,
    factors,
  };
}
export function rankRoutes(routes: ScoredRoute[]) {
  if (routes.some((r) => !r.hasInfrastructure))
    return [...routes].sort(
      (a, b) => a.duration - b.duration || a.id.localeCompare(b.id),
    );
  return [...routes].sort(
    (a, b) =>
      b.score - a.score || a.duration - b.duration || a.id.localeCompare(b.id),
  );
}
