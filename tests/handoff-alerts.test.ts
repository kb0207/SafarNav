import { expect, it, vi, afterEach } from "vitest";
import { googleMapsHandoff } from "@/lib/geo/google-maps";
import { distanceTo } from "@/lib/geo";
import { demoSnapshot } from "@/lib/providers/demo";
import { scoreRoute } from "@/lib/scoring/engine";
import { trackingState } from "@/lib/geo/tracking";
import {
  enableJourneyNotifications,
  sendJourneyNotification,
} from "@/lib/notifications";
afterEach(() => vi.unstubAllGlobals());
it("passes an on-route waypoint and the correct endpoints to Google Maps", () => {
  const snapshot = demoSnapshot("driving");
  const r = snapshot.routes[1];
  const handoff = googleMapsHandoff(
    r,
    snapshot.routes,
    snapshot.origin,
    snapshot.destination,
    "driving",
  );
  const params = new URL(handoff.url).searchParams;
  expect(params.get("api")).toBe("1");
  expect(params.get("travelmode")).toBe("driving");
  expect(params.get("origin")).toBe(
    `${snapshot.origin.coord[1].toFixed(6)},${snapshot.origin.coord[0].toFixed(6)}`,
  );
  expect(params.get("waypoints")).toBe(
    `${handoff.waypoint[1].toFixed(6)},${handoff.waypoint[0].toFixed(6)}`,
  );
  expect(distanceTo(handoff.waypoint, r.geometry)).toBeLessThan(1);
  expect(
    distanceTo(handoff.waypoint, snapshot.routes[0].geometry),
  ).toBeGreaterThan(10);
});
it("alerts strictly below 30, within range, with reliable on-route GPS", () => {
  const snapshot = demoSnapshot("driving");
  const r = scoreRoute(
    snapshot.routes[0],
    snapshot.infrastructure,
    "driving",
    new Date().toISOString(),
  );
  r.segments.forEach((s) => {
    s.score = 80;
  });
  r.segments[1].score = 30;
  const origin = snapshot.origin.coord;
  expect(trackingState(r, origin, 10).upcoming).toBeUndefined();
  r.segments[1].score = 29;
  expect(trackingState(r, origin, 10).upcoming?.id).toBe(r.segments[1].id);
  expect(trackingState(r, origin, 150).upcoming).toBeUndefined();
  expect(trackingState(r, [77.9, 28.9], 10).upcoming).toBeUndefined();
});
it("uses platform notifications only after permission and retains an on-screen fallback", async () => {
  const show = vi.fn().mockResolvedValue(undefined);
  const register = vi
    .fn()
    .mockResolvedValue({ active: true, showNotification: show });
  vi.stubGlobal("navigator", {
    serviceWorker: { register, getRegistration: register },
  });
  vi.stubGlobal("Notification", { permission: "granted" });
  expect(await enableJourneyNotifications()).toContain("enabled");
  await sendJourneyNotification("Section ahead", "section-1");
  expect(show).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ body: "Section ahead", tag: "section-1" }),
  );
  show.mockClear();
  vi.stubGlobal("Notification", { permission: "denied" });
  expect(await enableJourneyNotifications()).toContain("On-screen");
  await sendJourneyNotification("Section ahead", "section-2");
  expect(show).not.toHaveBeenCalled();
});
