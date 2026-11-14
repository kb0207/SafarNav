"use client";
import { DELHI_BOUNDS, DELHI_CENTER } from "@/lib/geo/region";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { circle } from "@turf/turf";
import type { FeatureCollection } from "geojson";
import type { Coord, Place, ScoredRoute } from "@/types";
interface Props {
  panelExpanded: boolean;
  routes: ScoredRoute[];
  selected: string;
  origin: Place | null;
  destination: Place | null;
  onPick: (c: Coord) => void;
  onSelect: (id: string) => void;
  location: { coord: Coord; accuracy: number } | null;
  recenter: number;
}
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
export default function RouteMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const latest = useRef(props);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const fitted = useRef("");
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map;
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    try {
      map = new maplibregl.Map({
        container: container.current,
        style:
          process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
          "https://tiles.openfreemap.org/styles/positron",
        center: DELHI_CENTER,
        maxBounds: DELHI_BOUNDS,
        renderWorldCopies: false,
        zoom: 13.5,
        attributionControl: { compact: true },
      });
    } catch {
      setTimeout(
        () =>
          setError(
            "This browser could not initialize the map. Enable WebGL or use a supported browser.",
          ),
        0,
      );
      return;
    }
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.on("error", () =>
      setError(
        "Some map tiles could not load. Route details remain available.",
      ),
    );
    map.on("load", () => {
      for (const id of [
        "routes",
        "weak",
        "uncertain",
        "pois",
        "accuracy",
        "location",
      ])
        map.addSource(id, { type: "geojson", data: empty });
      map.addLayer({
        id: "accuracy",
        type: "fill",
        source: "accuracy",
        paint: { "fill-color": "#2784dd", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": ["case", ["get", "selected"], 11, 7],
        },
      });
      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["case", ["get", "selected"], "#076344", "#87999e"],
          "line-width": ["case", ["get", "selected"], 6, 4],
          "line-opacity": ["case", ["get", "selected"], 1, 0.7],
        },
      });
      map.addLayer({
        id: "weak",
        type: "line",
        source: "weak",
        paint: {
          "line-color": "#d74945",
          "line-width": 7,
          "line-dasharray": [2, 1],
        },
      });
      map.addLayer({
        id: "uncertain",
        type: "line",
        source: "uncertain",
        paint: {
          "line-color": "#b48528",
          "line-width": 3,
          "line-dasharray": [1, 2],
        },
      });
      map.addLayer({
        id: "pois",
        type: "circle",
        source: "pois",
        paint: {
          "circle-radius": 5,
          "circle-color": [
            "match",
            ["get", "category"],
            "emergency",
            "#bd5c70",
            "parking",
            "#7777a8",
            "#29998a",
          ],
          "circle-stroke-color": "white",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "location",
        type: "circle",
        source: "location",
        paint: {
          "circle-radius": 7,
          "circle-color": "#2784dd",
          "circle-stroke-color": "white",
          "circle-stroke-width": 3,
        },
      });
      map.on("click", "routes", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) latest.current.onSelect(id);
      });
      for (const layer of ["pois", "weak"])
        map.on("click", layer, (e) => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          const node = document.createElement("div");
          const title = document.createElement("strong");
          title.textContent = p.title;
          const text = document.createElement("p");
          text.textContent = p.detail;
          node.append(title, text);
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setDOMContent(node)
            .addTo(map);
        });
      map.on("click", (e) => {
        if (
          !map.queryRenderedFeatures(e.point, {
            layers: ["routes", "pois", "weak"],
          }).length
        )
          latest.current.onPick([e.lngLat.lng, e.lngLat.lat]);
      });
      setReady(true);
    });
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const selected = props.routes.find((r) => r.id === props.selected);
    const set = (id: string, data: FeatureCollection) =>
      (map.getSource(id) as GeoJSONSource)?.setData(data);
    set("routes", {
      type: "FeatureCollection",
      features: [...props.routes]
        .sort(
          (a, b) =>
            Number(a.id === props.selected) - Number(b.id === props.selected),
        )
        .map((r) => ({
          type: "Feature",
          geometry: r.geometry,
          properties: { id: r.id, selected: r.id === props.selected },
        })),
    });
    set("weak", {
      type: "FeatureCollection",
      features: (selected?.segments.filter((s) => s.score < 35) ?? []).map(
        (s) => ({
          type: "Feature",
          geometry: s.geometry,
          properties: {
            title: `Section indicator ${Math.round(s.score)}/100`,
            detail: `${Math.round(s.length)} m. ${s.factors.lighting.evidence}. ${s.factors.isolation.evidence}`,
          },
        }),
      ),
    });
    set("uncertain", {
      type: "FeatureCollection",
      features: (
        selected?.segments.filter((s) => s.confidence < 40 && s.score >= 35) ??
        []
      ).map((s) => ({ type: "Feature", geometry: s.geometry, properties: {} })),
    });
    set("pois", {
      type: "FeatureCollection",
      features: (selected?.pois ?? [])
        .filter((p) => p.category !== "lamp")
        .map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: p.coord },
          properties: {
            category: p.category,
            title: p.name,
            detail: `${p.status === "unknown" ? "Hours unknown" : `Expected ${p.status}`} at ${new Date(p.passingTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. ${p.tags.opening_hours ?? "No schedule"}. Source: ${p.source === "demo" ? "fictional demo" : p.source === "geoapify" ? `Geoapify (OSM-derived) ${p.id}` : `OpenStreetMap ${p.id}`}. Proximity only.`,
          },
        })),
    });
    const fingerprint = props.routes
      .map((r) => r.id + JSON.stringify(r.geometry.coordinates))
      .join("");
    const mobile = window.matchMedia("(max-width: 720px)").matches;
    const fitKey = fingerprint + String(props.panelExpanded) + String(mobile);
    if (fingerprint && fitKey !== fitted.current) {
      const bounds = new maplibregl.LngLatBounds();
      props.routes.forEach((r) =>
        r.geometry.coordinates.forEach((c) => bounds.extend(c as Coord)),
      );
      map.fitBounds(bounds, {
        padding: mobile
          ? {
              top: 65,
              left: 40,
              right: 45,
              bottom: props.panelExpanded
                ? map.getContainer().clientHeight * 0.59 + 25
                : 65,
            }
          : 65,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 700,
      });
      fitted.current = fitKey;
    }
  }, [ready, props.routes, props.selected, props.panelExpanded]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const markers: maplibregl.Marker[] = [];
    for (const [p, label] of [
      [props.origin, "A"],
      [props.destination, "B"],
    ] as const) {
      if (!p) continue;
      const el = document.createElement("div");
      el.className = `place-marker ${label === "B" ? "destination" : ""}`;
      el.textContent = label;
      el.setAttribute("aria-label", p.name);
      markers.push(
        new maplibregl.Marker({ element: el })
          .setLngLat(p.coord)
          .addTo(mapRef.current),
      );
    }
    return () => markers.forEach((m) => m.remove());
  }, [ready, props.origin, props.destination]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const loc = props.location;
    (map.getSource("location") as GeoJSONSource).setData(
      loc
        ? {
            type: "Feature",
            geometry: { type: "Point", coordinates: loc.coord },
            properties: {},
          }
        : empty,
    );
    (map.getSource("accuracy") as GeoJSONSource).setData(
      loc ? circle(loc.coord, loc.accuracy, { units: "meters" }) : empty,
    );
  }, [ready, props.location]);
  useEffect(() => {
    if (props.recenter && latest.current.location)
      mapRef.current?.easeTo({
        center: latest.current.location.coord,
        zoom: 16,
      });
  }, [props.recenter]);
  return (
    <>
      <div
        ref={container}
        className="map-canvas"
        aria-label="Interactive route map"
      />
      {error && (
        <div className="map-error" role="status">
          {error}
        </div>
      )}
    </>
  );
}
