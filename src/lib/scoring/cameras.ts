import { radius } from "./config";
import type { EvaluatedPOI, Infrastructure, Mode } from "@/types";
export function isCamera(p: Infrastructure) {
  return (
    p.category === "surveillance" &&
    (p.tags["surveillance:type"] === "camera" ||
      (!!p.tags["camera:type"] && !p.tags["surveillance:type"]))
  );
}
// Nearby route length is a proximity proxy, never a camera field of view.
export function cameraMetrics(pois: EvaluatedPOI[], total: number, mode: Mode) {
  const cameras = [
    ...new Map(pois.filter(isCamera).map((p) => [p.id, p])).values(),
  ];
  const intervals = cameras
    .map((p) => {
      const reach = Math.sqrt(
        Math.max(0, radius("surveillance", mode) ** 2 - p.distanceToRoute ** 2),
      );
      return [Math.max(0, p.along - reach), Math.min(total, p.along + reach)];
    })
    .sort((a, b) => a[0] - b[0]);
  let covered = 0,
    end = 0,
    largestGap = 0;
  for (const [a, b] of intervals) {
    largestGap = Math.max(largestGap, a - end);
    covered += Math.max(0, b - Math.max(end, a));
    end = Math.max(end, b);
  }
  largestGap = Math.max(largestGap, total - end);
  return {
    count: cameras.length,
    nearbyPercent: total ? (100 * covered) / total : 0,
    largestGap,
    radiusMetres: radius("surveillance", mode),
  };
}
