import type { FactorName, Mode } from "@/types";
export const weights: Record<Mode, Record<FactorName, number>> = {
  walking: {
    activity: 20,
    lighting: 22,
    road: 12,
    isolation: 18,
    emergency: 10,
    transport: 5,
    surveillance: 3,
    suitability: 10,
  },
  driving: {
    activity: 8,
    lighting: 12,
    road: 28,
    isolation: 8,
    emergency: 10,
    transport: 2,
    surveillance: 2,
    suitability: 30,
  },
};
// Conservative evidence caps and bottleneck penalties, not calibrated risk probabilities.
export const scoringPolicy = {
  sparseEvidenceCeiling: 60,
  downsideThreshold: 40,
  downsidePenalty: 0.5,
  weakestFraction: 0.2,
  weakestBlend: 0.35,
  criticalSuitabilityCeiling: 25,
};
export const WEAK_THRESHOLD = 35;
export const clamp = (n: number) => Math.min(100, Math.max(0, n));
export const saturation = (n: number, scale = 2) =>
  100 * (1 - Math.exp(-Math.max(0, n) / scale));
export const radius = (category: string, mode: Mode) =>
  category === "emergency"
    ? 400
    : category === "road"
      ? 25
      : category === "surveillance"
        ? 60
        : category === "lamp"
          ? 40
          : mode === "walking"
            ? 100
            : 180;
