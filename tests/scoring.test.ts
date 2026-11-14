import { describe, it, expect } from "vitest";
import { weights, saturation, clamp } from "@/lib/scoring/config";
import {
  scoreRoute,
  aggregateScore,
  rankRoutes,
  weakMetrics,
  weightedMean,
} from "@/lib/scoring/engine";
import { openingStatus } from "@/lib/scoring/hours";
import { demoSnapshot } from "@/lib/providers/demo";
import type { Coord, Infrastructure, Route } from "@/types";
const delhi: Coord = [77.22, 28.62];
const at = (s: string) => new Date(s + "+05:30");
const route: Route = {
  id: "test",
  name: "Test",
  geometry: {
    type: "LineString",
    coordinates: [
      [77.22, 28.62],
      [77.23, 28.62],
    ],
  },
  distance: 976,
  duration: 1800,
};
const shop: Infrastructure = {
  id: "shop",
  name: "Fixture",
  coord: [77.229, 28.62],
  category: "business",
  tags: { opening_hours: "Mo-Su 09:00-21:40" },
  source: "demo",
  fetchedAt: new Date().toISOString(),
};
describe("opening hours in location timezone", () => {
  it("keeps missing and invalid hours unknown", () => {
    expect(openingStatus(undefined, at("2026-11-14T12:00:00"), delhi)).toBe(
      "unknown",
    );
    expect(openingStatus("not a schedule", new Date(), delhi)).toBe("unknown");
  });
  it("handles 24-hour schedules", () =>
    expect(openingStatus("24/7", at("2026-11-14T03:00:00"), delhi)).toBe(
      "open",
    ));
  it("handles overnight schedules crossing midnight", () => {
    expect(
      openingStatus("Fr 20:00-02:00", at("2026-11-14T01:00:00"), delhi),
    ).toBe("open");
    expect(
      openingStatus("Fr 20:00-02:00", at("2026-11-14T03:00:00"), delhi),
    ).toBe("closed");
  });
  it("respects weekdays", () => {
    expect(
      openingStatus("Mo-Fr 09:00-18:00", at("2026-11-13T12:00:00"), delhi),
    ).toBe("open");
    expect(
      openingStatus("Mo-Fr 09:00-18:00", at("2026-11-14T12:00:00"), delhi),
    ).toBe("closed");
  });
  it("does not guess holiday calendars", () =>
    expect(
      openingStatus(
        "Mo-Su 09:00-18:00; PH off",
        at("2026-11-14T12:00:00"),
        delhi,
      ),
    ).toBe("unknown"));
  it("evaluates arrival time rather than departure", () => {
    const scored = scoreRoute(
      route,
      [shop],
      "walking",
      at("2026-11-14T21:30:00").toISOString(),
    );
    expect(
      openingStatus(shop.tags.opening_hours, at("2026-11-14T21:30:00"), delhi),
    ).toBe("open");
    expect(scored.pois[0].status).toBe("closed");
    expect(new Date(scored.pois[0].passingTime).getTime()).toBeGreaterThan(
      at("2026-11-14T21:40:00").getTime(),
    );
  });
});
describe("deterministic explainable scoring", () => {
  it("has weights totaling 100 in both modes", () => {
    for (const w of Object.values(weights))
      expect(Object.values(w).reduce((a, b) => a + b)).toBe(100);
    expect(weights.walking).not.toEqual(weights.driving);
  });
  it("bounds normalization", () => {
    for (const n of [-100, 0, 0.5, 50, 500]) {
      expect(clamp(n)).toBeGreaterThanOrEqual(0);
      expect(clamp(n)).toBeLessThanOrEqual(100);
      expect(saturation(n)).toBeGreaterThanOrEqual(0);
      expect(saturation(n)).toBeLessThanOrEqual(100);
    }
  });
  it("changes when shops close and gives closed shops no activity credit", () => {
    const open = scoreRoute(
      route,
      [shop],
      "walking",
      at("2026-11-14T20:00:00").toISOString(),
    );
    const closed = scoreRoute(
      route,
      [shop],
      "walking",
      at("2026-11-14T22:00:00").toISOString(),
    );
    expect(open.score).toBeGreaterThan(closed.score);
    expect(
      closed.segments
        .filter((s) => s.factors.activity.known)
        .every((s) => s.factors.activity.score === 0),
    ).toBe(true);
  });
  it("does not convert unknown lighting to darkness", () => {
    const s = scoreRoute(
      route,
      [],
      "walking",
      at("2026-11-14T23:00:00").toISOString(),
    );
    expect(s.segments[0].factors.lighting).toMatchObject({
      score: 50,
      known: false,
    });
  });
  it("adjusts lighting with daylight", () => {
    const night = scoreRoute(
      route,
      [],
      "walking",
      at("2026-11-14T23:00:00").toISOString(),
    );
    const day = scoreRoute(
      route,
      [],
      "walking",
      at("2026-11-14T12:00:00").toISOString(),
    );
    expect(day.factors.lighting.score).toBeGreaterThan(
      night.factors.lighting.score,
    );
  });
  it("uses actual length weights, not a simple average", () =>
    expect(
      weightedMean([
        { score: 20, length: 100 },
        { score: 80, length: 300 },
      ]),
    ).toBe(65));
  it("does not reward length alone", () => {
    const longer = {
      ...route,
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [77.22, 28.62],
          [77.24, 28.62],
        ],
      },
    };
    const t = at("2026-11-14T22:00:00").toISOString();
    expect(scoreRoute(longer, [], "walking", t).score).toBeCloseTo(
      scoreRoute(route, [], "walking", t).score,
      6,
    );
  });
  it("merges only consecutive weak sections", () =>
    expect(
      weakMetrics([
        { score: 20, length: 150 },
        { score: 30, length: 100 },
        { score: 50, length: 150 },
        { score: 10, length: 200 },
      ]),
    ).toEqual({ weakLength: 450, longestWeak: 250, weakCount: 3 }));
  it("lowers confidence for missing evidence", () => {
    const snapshot = demoSnapshot("walking");
    const t = at("2026-11-14T22:00:00").toISOString();
    expect(
      scoreRoute(snapshot.routes[0], snapshot.infrastructure, "walking", t)
        .confidence,
    ).toBeGreaterThan(
      scoreRoute(snapshot.routes[0], [], "walking", t).confidence,
    );
  });
  it("keeps all sections bounded and rankings deterministic", () => {
    const s = demoSnapshot("walking");
    const routes = s.routes.map((r) =>
      scoreRoute(
        r,
        s.infrastructure,
        "walking",
        at("2026-11-14T22:00:00").toISOString(),
      ),
    );
    for (const r of routes) {
      expect(r.segments.every((s) => s.score >= 0 && s.score <= 100)).toBe(
        true,
      );
      expect(r.score).toBeCloseTo(aggregateScore(r.segments));
    }
    expect(rankRoutes(routes)).toEqual(rankRoutes([...routes].reverse()));
    expect(routes[2].weakCount).toBeGreaterThan(0);
  });
  it("does not reward restricted road access", () => {
    const infra: Infrastructure = {
      ...shop,
      id: "road",
      category: "road",
      geometry: route.geometry,
      tags: { highway: "residential", access: "private" },
    };
    const s = scoreRoute(route, [infra], "driving", new Date().toISOString());
    expect(s.factors.suitability.score).toBe(0);
  });
});

describe("strict evidence and bottleneck scoring", () => {
  it("separates a well-supported route above 80 from a documented poor route below 35", () => {
    const road: Infrastructure = {
      ...shop,
      id: "full-road",
      category: "road",
      geometry: route.geometry,
      tags: { highway: "footway", lit: "yes", sidewalk: "both" },
    };
    const businesses: Infrastructure[] = Array.from({ length: 31 }, (_, i) => ({
      ...shop,
      id: `shop-${i}`,
      coord: [77.22 + (i * 0.01) / 30, 28.62],
      tags: { opening_hours: "24/7" },
    }));
    const time = "2026-11-15T23:00:00+05:30";
    const good = scoreRoute(route, [road, ...businesses], "walking", time);
    const bad = scoreRoute(
      route,
      [
        { ...road, tags: { highway: "motorway", lit: "no", sidewalk: "no" } },
        ...businesses.map((p) => ({
          ...p,
          tags: { opening_hours: "Mo-Su 09:00-10:00" },
        })),
      ],
      "walking",
      time,
    );
    expect(good.score).toBeGreaterThanOrEqual(80);
    expect(bad.score).toBeLessThan(35);
    expect(good.confidence).toBeGreaterThan(70);
  });
  it("does not let a good average conceal a bad stretch", () => {
    const uniform = [{ score: 70, length: 1000, confidence: 100 }];
    const bottleneck = [
      { score: 85, length: 800, confidence: 100 },
      { score: 10, length: 200, confidence: 100 },
    ];
    expect(weightedMean(uniform)).toBe(weightedMean(bottleneck));
    expect(aggregateScore(bottleneck)).toBeLessThan(
      aggregateScore(uniform) - 15,
    );
    expect(aggregateScore(bottleneck)).toBeCloseTo(
      aggregateScore([
        { score: 85, length: 400, confidence: 100 },
        { score: 85, length: 400, confidence: 100 },
        { score: 10, length: 100, confidence: 100 },
        { score: 10, length: 100, confidence: 100 },
      ]),
    );
  });
  it("keeps missing evidence unavailable and cannot award 80 for isolated positive evidence", () => {
    const time = "2026-11-15T23:00:00+05:30";
    expect(scoreRoute(route, [], "walking", time).hasInfrastructure).toBe(
      false,
    );
    const unknown = scoreRoute(route, [{ ...shop, tags: {} }], "walking", time);
    expect(unknown.hasInfrastructure).toBe(false);
    const sparse = scoreRoute(
      route,
      [{ ...shop, category: "emergency", tags: {} }],
      "walking",
      time,
    );
    expect(sparse.score).toBeLessThan(70);
  });
});
