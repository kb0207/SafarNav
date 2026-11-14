"use client";
import { ExternalLink, MapPin } from "lucide-react";
import { googleMapsHandoff } from "@/lib/geo/google-maps";
import type { Mode, Place, Route } from "@/types";
export default function GoogleMapsHandoff({
  route,
  routes,
  origin,
  destination,
  mode,
  demo,
}: {
  route: Route;
  routes: Route[];
  origin: Place;
  destination: Place;
  mode: Mode;
  demo: boolean;
}) {
  const handoff = googleMapsHandoff(route, routes, origin, destination, mode);
  return (
    <section
      className="summary-card google-handoff"
      aria-label="Google Maps handoff"
    >
      <h3>
        <MapPin size={17} /> Continue in Google Maps
      </h3>
      <p>
        Keep {route.name} in your directions by including a route-shaping
        waypoint.
      </p>
      <p className="muted">
        Waypoint: {handoff.waypoint[1].toFixed(5)},{" "}
        {handoff.waypoint[0].toFixed(5)}. It marks a road position, not a
        verified parking or stopping place.
      </p>
      {demo ? (
        <button className="secondary full" disabled>
          Google Maps handoff available for real routes
        </button>
      ) : (
        <a
          className="secondary full"
          href={handoff.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open selected route + waypoint <ExternalLink size={16} />
        </a>
      )}
      <p className="muted">
        Google Maps recalculates directions between stops. Check its preview:
        the exact SafarNav route cannot be locked.
      </p>
    </section>
  );
}
