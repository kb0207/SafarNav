"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Car,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  Footprints,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Info,
  X,
  Copy,
  ExternalLink,
  Moon,
} from "lucide-react";
import PlaceSearch from "./PlaceSearch";
import Journey from "./Journey";
import GoogleMapsHandoff from "./GoogleMapsHandoff";
import { enableJourneyNotifications } from "@/lib/notifications";
import Feedback from "./Feedback";
import { demoPlaces } from "@/lib/providers/demo";
import type { Coord, Mode, Place, RouteResponse } from "@/types";
import type { Summary } from "@/lib/ai";
import type { UberPreview } from "@/lib/uber";
const RouteMap = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => <div className="map-loading">Preparing your map…</div>,
});
async function post<T>(
  path: string,
  value: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    signal,
  });
  const data = await r.json();
  if (!r.ok)
    throw Error(data.error?.message ?? "Request failed. Please retry.");
  return data;
}
const dateLabel = (s: string) =>
  new Date(s).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function Planner({
  demo,
  initialOrigin,
  initialDestination,
  initialMode = "driving",
  initialNow,
}: {
  demo: boolean;
  initialOrigin?: Place;
  initialDestination?: Place;
  initialMode?: Mode;
  initialNow: number;
}) {
  const [origin, setOrigin] = useState<Place | null>(
    demo ? demoPlaces[0] : (initialOrigin ?? null),
  );
  const [destination, setDestination] = useState<Place | null>(
    demo ? demoPlaces[1] : (initialDestination ?? null),
  );
  const [notificationStatus, setNotificationStatus] = useState("");
  const [mode, setMode] = useState<Mode>(initialMode);
  const [data, setData] = useState<RouteResponse | null>(null);
  const [selected, setSelected] = useState("");
  const [base, setBase] = useState(initialNow);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summaryResult, setSummary] = useState<
    (Summary & { context: string }) | null
  >(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [active, setActive] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [location, setLocation] = useState<{
    coord: Coord;
    accuracy: number;
  } | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [pick, setPick] = useState<"origin" | "destination" | null>(null);
  const [uber, setUber] = useState<UberPreview | null>(null);
  const [uberBusy, setUberBusy] = useState(false);
  const [stopId, setStopId] = useState("");
  const [consent, setConsent] = useState(false);
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState(true);
  const request = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const comparisonRef = useRef<HTMLElement>(null);
  const departure = new Date(base + offset * 60000).toISOString();
  const route = data?.routes.find((r) => r.id === selected) ?? data?.routes[0];
  const token = data?.token;
  const assessmentAvailable = !!data?.routes.every((r) => r.hasInfrastructure);
  const scoredDeparture = data?.departure;
  const rescoring = !!data && scoredDeparture !== departure;
  const summary =
    summaryResult?.context === `${token}:${departure}` ? summaryResult : null;
  const updateLocation = useCallback(
    (p: { coord: Coord; accuracy: number } | null) => setLocation(p),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    if (!token || scoredDeparture === departure) return;
    const timer = setTimeout(async () => {
      try {
        const next = await post<RouteResponse>(
          "/api/routes/rescore",
          { token, departure },
          controller.signal,
        );
        setData(next);
        setError("");
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [departure, token, scoredDeparture]);
  useEffect(() => {
    if (token)
      comparisonRef.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
  }, [token]);
  useEffect(() => {
    if (uber) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [uber]);
  function invalidate() {
    request.current?.abort();
    setData(null);
    setSelected("");
    setSummary(null);
    setFeedback(false);
    setError("");
    setBusy(false);
  }
  async function calculate() {
    if (!origin || !destination) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setSummary(null);
    setFeedback(false);
    setData(null);
    try {
      const result = await post<RouteResponse>(
        "/api/routes",
        { origin, destination, mode, departure },
        controller.signal,
      );
      setData(result);
      setSelected(result.routes[0].id);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError("Location is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const coord: Coord = [p.coords.longitude, p.coords.latitude];
        setLocation({ coord, accuracy: p.coords.accuracy });
        if (!demo) {
          invalidate();
          setOrigin({ name: "Current location", coord });
        } else
          setNotice(
            "Location displayed. Demo routes remain fixed to the New Delhi sample.",
          );
        setRecenter((n) => n + 1);
      },
      (e) => setError(e.message),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }
  function mapPick(coord: Coord) {
    if (!pick) return;
    invalidate();
    const p = {
      name: `Map point · ${coord[1].toFixed(4)}, ${coord[0].toFixed(4)}`,
      coord,
    };
    if (pick === "origin") setOrigin(p);
    else setDestination(p);
    setPick(null);
  }
  async function getSummary() {
    if (!data) return;
    setSummaryBusy(true);
    try {
      setSummary({
        ...(await post<Summary>("/api/ai/route-summary", {
          token: data.token,
          departure,
        })),
        context: `${data.token}:${departure}`,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSummaryBusy(false);
    }
  }
  async function getUber(withStop = false) {
    if (!data || !route) return;
    setUberBusy(true);
    try {
      const result = await post<UberPreview>("/api/uber/link", {
        token: data.token,
        routeId: route.id,
        ...(withStop && stopId ? { stopId, consent } : {}),
      });
      setUber(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUberBusy(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Copied to clipboard.");
    } catch {
      setNotice(`Copy manually: ${text}`);
    }
  }
  function share() {
    if (!origin || !destination) return;
    const url = new URL(window.location.origin);
    url.search = new URLSearchParams({
      from: origin.coord.join(","),
      to: destination.coord.join(","),
      mode,
    }).toString();
    void copy(url.toString());
  }
  const fastest = data ? Math.min(...data.routes.map((r) => r.duration)) : 0;
  return (
    <main className={dark ? "app dark" : "app"}>
      <header className="header">
        <Link href="/" className="brand" aria-label="SafarNav home">
          <span className="brand-icon">
            <Navigation size={23} fill="currentColor" />
          </span>
          <span>
            Safar<span className="brand-accent">Nav</span>
            <small>MOVE WITH MORE CONFIDENCE</small>
          </span>
        </Link>
        <nav>
          <span className="nav-active">
            <Compass size={16} /> Route planner
          </span>
          <button
            onClick={() => document.getElementById("about")?.showPopover()}
          >
            <Info size={16} /> How it works
          </button>
        </nav>
        <div className="header-right">
          <span className={`mode-badge ${demo ? "" : "live"}`}>
            <span />
            {demo ? "DEMO EXPERIENCE" : "MAPPED DATA"}
          </span>
          <button
            className="icon-button"
            aria-label="Toggle dark theme"
            aria-pressed={dark}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      <div id="about" popover="auto" className="about-popover">
        <h2>A little more insight for the road.</h2>
        <p>
          SafarNav compares mapped infrastructure, expected opening hours and
          route suitability. It does not measure crime or predict personal
          safety.
        </p>
        <p>
          Each section combines available infrastructure evidence; your route
          indicator combines the route average with its weakest sections.
          Observed weaknesses reduce the score; limited evidence caps high
          scores.
        </p>
        <p>
          Safety scores are estimates based on available infrastructure and
          mapping data. They do not guarantee personal safety.
        </p>
        <button
          className="primary"
          onClick={() => document.getElementById("about")?.hidePopover()}
        >
          Got it
        </button>
      </div>
      <div className="workspace">
        <aside className={`sidebar ${expanded ? "expanded" : "collapsed"}`}>
          <button
            className="mobile-handle"
            aria-label="Toggle planning panel"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <span />
          </button>
          <div className="sidebar-content">
            <div className="intro">
              <span className="eyebrow">A BETTER WAY TO GET THERE</span>
              <h1>
                Not just the shortest route.
                <br />
                <span>The safer one.</span>
              </h1>
              <p>Compare your options. Understand the journey.</p>
            </div>
            <section className="search-panel" aria-label="Plan your journey">
              <div className="mode-toggle">
                <button
                  disabled={active}
                  aria-pressed={mode === "driving"}
                  className={mode === "driving" ? "selected" : ""}
                  onClick={() => {
                    if (mode !== "driving") {
                      invalidate();
                      setMode("driving");
                    }
                  }}
                >
                  <Car size={18} /> Driving
                </button>
                <button
                  disabled={active}
                  aria-pressed={mode === "walking"}
                  className={mode === "walking" ? "selected" : ""}
                  onClick={() => {
                    if (mode !== "walking") {
                      invalidate();
                      setMode("walking");
                    }
                  }}
                >
                  <Footprints size={17} /> Walking
                </button>
              </div>
              <div className="location-fields">
                <div className="location-line">
                  <span className="origin-dot" />
                  <span className="dotted-line" />
                  <MapPin size={17} />
                </div>
                <div className="fields">
                  <PlaceSearch
                    label="From"
                    value={origin}
                    disabled={active || demo}
                    onChange={(p) => {
                      invalidate();
                      setOrigin(p);
                    }}
                  />
                  <PlaceSearch
                    label="To"
                    value={destination}
                    disabled={active || demo}
                    onChange={(p) => {
                      invalidate();
                      setDestination(p);
                    }}
                  />
                </div>
                <button
                  className="swap icon-button"
                  disabled={active || demo}
                  aria-label="Swap locations"
                  onClick={() => {
                    invalidate();
                    setOrigin(destination);
                    setDestination(origin);
                  }}
                >
                  <ArrowDownUp size={17} />
                </button>
              </div>
              <div className="search-shortcuts">
                <button disabled={active} onClick={locate}>
                  <LocateFixed size={13} /> My location
                </button>
                {!demo && (
                  <>
                    <button disabled={active} onClick={() => setPick("origin")}>
                      Set A on map
                    </button>
                    <button
                      disabled={active}
                      onClick={() => setPick("destination")}
                    >
                      Set B on map
                    </button>
                  </>
                )}
                {demo && <span>New Delhi sample journey</span>}
              </div>
              <button
                className="primary full find-button"
                disabled={!origin || !destination || busy || active}
                onClick={calculate}
              >
                {busy ? "Finding your routes…" : "Compare routes"}
                {!busy && <ArrowRight size={18} />}
              </button>
            </section>
            {error && (
              <div role="alert" className="notice error">
                {error}
                <button onClick={() => setError("")} aria-label="Dismiss error">
                  <X size={14} />
                </button>
              </div>
            )}
            {notice && (
              <div role="status" className="notice">
                {notice}
                <button
                  onClick={() => setNotice("")}
                  aria-label="Dismiss notice"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <section className="time-machine" aria-label="Time Machine">
              <div className="section-heading">
                <h2>
                  <Clock3 size={17} /> Time Machine{" "}
                  <span className="tiny-tag">24H</span>
                </h2>
                <button
                  aria-label="Reset departure to now"
                  className="icon-button"
                  disabled={active}
                  onClick={() => {
                    setBase(Date.now());
                    setOffset(0);
                  }}
                >
                  <RotateCcw size={14} />
                </button>
              </div>
              <p>Same route. A different time of day.</p>
              <div className="departure">
                <Sun size={16} />
                <strong suppressHydrationWarning>{dateLabel(departure)}</strong>
                <span>
                  {offset === 0
                    ? "Now"
                    : `+${Math.floor(offset / 60)}h ${offset % 60}m`}
                </span>
              </div>
              <input
                aria-label="Departure time offset"
                type="range"
                min={0}
                max={1440}
                step={15}
                value={offset}
                disabled={active || busy}
                onChange={(e) => setOffset(Number(e.target.value))}
              />
              <div className="slider-labels">
                <span>Now</span>
                <span>+6h</span>
                <span>+12h</span>
                <span>+18h</span>
                <span>+24h</span>
              </div>
            </section>
            {busy && (
              <div className="skeleton" role="status">
                Comparing routes and mapped infrastructure…
              </div>
            )}
            {!data && !busy && (
              <div className="empty-card">
                <div className="empty-icon">
                  <ShieldCheck size={26} />
                </div>
                <h3>Your route, with more context.</h3>
                <p>
                  Explore mapped lighting, nearby support and expected street
                  activity before you head out.
                </p>
                <div className="empty-chips">
                  <span>Explainable scores</span>
                  <span>Time-aware insights</span>
                </div>
              </div>
            )}
            {data && route && (
              <>
                <section
                  ref={comparisonRef}
                  className="route-comparison"
                  aria-label="Route comparison"
                >
                  <div className="section-heading">
                    <h2>
                      Your routes{" "}
                      <span className="count">{data.routes.length}</span>
                    </h2>
                    <span className="muted" role="status">
                      {rescoring
                        ? "Updating…"
                        : assessmentAvailable
                          ? "Ranked by indicator"
                          : "Ordered by travel time"}
                    </span>
                  </div>
                  {data.warnings.map((w) => (
                    <p key={w} className="data-note">
                      {w}
                    </p>
                  ))}
                  {data.routes.map((r, i) => (
                    <button
                      key={r.id}
                      className={`route-card ${r.id === route.id ? "active" : ""}`}
                      disabled={active}
                      onClick={() => setSelected(r.id)}
                      aria-pressed={r.id === route.id}
                    >
                      <div className="route-card-main">
                        <div className="route-copy">
                          <span
                            className={`route-label ${i === 0 && assessmentAvailable ? "recommended" : ""}`}
                          >
                            {i === 0 && assessmentAvailable
                              ? "HIGHEST INDICATOR"
                              : r.duration === fastest
                                ? "FASTEST OPTION"
                                : "ALTERNATIVE"}
                          </span>
                          <h3>{r.name}</h3>
                          <p>
                            <strong>{Math.ceil(r.duration / 60)} min</strong>
                            <span> · {(r.distance / 1000).toFixed(1)} km</span>
                            {r.duration > fastest + 30 && (
                              <span className="extra">
                                {" "}
                                +{Math.round((r.duration - fastest) / 60)} min
                              </span>
                            )}
                          </p>
                        </div>
                        <div
                          className={`score ${!r.hasInfrastructure ? "unavailable" : r.score < 35 ? "low" : ""}`}
                          aria-label={
                            r.hasInfrastructure
                              ? `Indicator ${Math.round(r.score)} out of 100`
                              : "Score unavailable"
                          }
                        >
                          <strong>
                            {r.hasInfrastructure ? Math.round(r.score) : "—"}
                          </strong>
                          <span>
                            {r.hasInfrastructure ? "/ 100" : "No data"}
                          </span>
                        </div>
                      </div>
                      <div className="route-card-footer">
                        <span>
                          {r.hasInfrastructure
                            ? "View route details"
                            : "Assessment unavailable"}
                        </span>
                        <ChevronRight size={15} />
                      </div>
                      <span className="route-eta">
                        ETA{" "}
                        {new Date(
                          new Date(departure).getTime() + r.duration * 1000,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        ·{" "}
                        {r.hasInfrastructure
                          ? `${Math.round(r.weakLength)} m of weak sections`
                          : "Weak sections not assessed"}
                      </span>
                    </button>
                  ))}
                </section>
                <details className="details" open>
                  <summary>
                    Mapped security cameras <ChevronDown size={16} />
                  </summary>
                  {route.cameras.count > 0 ? (
                    <>
                      <div className="weak-stats">
                        <span>
                          Mapped camera locations
                          <strong>{route.cameras.count}</strong>
                        </span>
                        <span>
                          Route near cameras
                          <strong>
                            {route.cameras.nearbyPercent.toFixed(1)}%
                          </strong>
                        </span>
                        <span>
                          Largest gap between nearby areas
                          <strong>
                            {Math.round(route.cameras.largestGap)} m
                          </strong>
                        </span>
                      </div>
                      <p className="muted">
                        Within {route.cameras.radiusMetres} m of explicitly
                        mapped cameras. This describes their distribution, not
                        verified viewing coverage or operation.
                      </p>
                    </>
                  ) : (
                    <p className="muted">
                      No verified camera-type records in the available map data.
                      Camera count and distribution are unknown; this does not
                      mean there are no cameras.
                    </p>
                  )}
                </details>
                {route.hasInfrastructure && (
                  <details className="details" open>
                    <summary>
                      Behind the indicator <ChevronDown size={16} />
                    </summary>
                    <p className="muted">
                      Infrastructure estimate, not a probability of safety.
                    </p>
                    <div className="factor-list">
                      {Object.entries(route.factors).map(([name, f]) => (
                        <div key={name} className="factor">
                          <span>{name}</span>
                          <div className="factor-track">
                            <i style={{ width: `${f.score}%` }} />
                          </div>
                          <strong>{Math.round(f.score)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="weak-stats">
                      <span>
                        Lowest section
                        <strong>{Math.round(route.lowest)}/100</strong>
                      </span>
                      <span>
                        Weak sections<strong>{route.weakCount}</strong>
                      </span>
                      <span>
                        Longest weak stretch
                        <strong>{Math.round(route.longestWeak)} m</strong>
                      </span>
                    </div>
                    <details className="section-list">
                      <summary>Inspect individual sections</summary>
                      {route.segments.map((s, i) => (
                        <details key={s.id}>
                          <summary>
                            Section {i + 1} · {Math.round(s.score)}/100 ·{" "}
                            {Math.round(s.length)} m
                          </summary>
                          {Object.entries(s.factors).map(([k, f]) => (
                            <p key={k}>
                              <strong>
                                {k}: {Math.round(f.score)}
                              </strong>{" "}
                              — {f.evidence} {!f.known && "(uncertain)"}
                            </p>
                          ))}
                        </details>
                      ))}
                    </details>
                  </details>
                )}
                <details className="details">
                  <summary>
                    Nearby mapped places <span>{route.pois.length}</span>
                  </summary>
                  <p className="muted">
                    Proximity only. Access and staffing are unverified.
                  </p>
                  <div className="poi-list">
                    {route.pois.map((p) => (
                      <div key={p.id}>
                        <strong>{p.name}</strong>
                        <span
                          className={
                            p.status === "open" ? "open-status" : "muted"
                          }
                        >
                          {p.status === "unknown"
                            ? "Hours unknown"
                            : `Expected ${p.status}`}
                        </span>
                        <small>
                          Passing {dateLabel(p.passingTime)} ·{" "}
                          {Math.round(p.distanceToRoute)} m away
                        </small>
                        <small>
                          {p.tags.opening_hours ?? "No opening-hours schedule"}{" "}
                          ·{" "}
                          {p.source === "demo"
                            ? "Fictional demo"
                            : p.source === "geoapify"
                              ? `Geoapify · ${p.id}`
                              : `OSM ${p.id}`}
                        </small>
                      </div>
                    ))}
                  </div>
                </details>
                <section className="summary-card">
                  <div className="section-heading">
                    <h2>
                      <Sparkles size={17} /> A clearer picture
                    </h2>
                  </div>
                  <p>Understand the trade-offs behind your options.</p>
                  <button
                    className="secondary full"
                    disabled={summaryBusy || rescoring}
                    onClick={getSummary}
                  >
                    {summaryBusy ? "Preparing explanation…" : "View Summary"}
                    <ArrowRight size={16} />
                  </button>
                  {summary && (
                    <div className="summary-result">
                      <span className="tiny-tag">
                        {summary.source === "gemini"
                          ? "GEMINI EXPLANATION"
                          : "COMPUTED SUMMARY"}
                      </span>
                      <h3>{summary.headline}</h3>
                      {summary.whyRecommended.map((t) => (
                        <p key={t}>{t}</p>
                      ))}
                      <p>{summary.comparison}</p>
                    </div>
                  )}
                </section>
                {origin && destination && !active && (
                  <GoogleMapsHandoff
                    route={route}
                    routes={data.routes}
                    origin={origin}
                    destination={destination}
                    mode={mode}
                    demo={demo}
                  />
                )}
                {!active && !feedback && (
                  <div className="journey-actions">
                    <button
                      className="primary full"
                      disabled={rescoring}
                      onClick={() => {
                        setActive(true);
                        void enableJourneyNotifications().then(
                          setNotificationStatus,
                        );
                      }}
                    >
                      <Navigation size={17} /> Start journey
                    </button>
                    <p className="muted">
                      Starts foreground GPS monitoring with your permission.
                    </p>
                    {mode === "driving" && (
                      <button
                        className="uber-button full"
                        disabled={uberBusy}
                        onClick={() => {
                          setStopId("");
                          setConsent(false);
                          void getUber();
                        }}
                      >
                        {uberBusy
                          ? "Preparing handoff…"
                          : "Open this route in Uber"}
                        <ExternalLink size={16} />
                      </button>
                    )}
                    <button className="text-button" onClick={share}>
                      Copy shareable journey link
                    </button>
                  </div>
                )}
                {active && (
                  <Journey
                    route={route}
                    notificationStatus={notificationStatus}
                    onLocation={updateLocation}
                    onFinish={() => {
                      setActive(false);
                      setFeedback(true);
                    }}
                    onDiscard={() => setActive(false)}
                  />
                )}
                {feedback && (
                  <Feedback
                    token={data.token}
                    route={route}
                    onClose={() => {
                      setFeedback(false);
                      invalidate();
                    }}
                  />
                )}
                <p className="source-note">
                  {data.demo
                    ? "Synthetic fixture data"
                    : "OpenStreetMap infrastructure"}{" "}
                  · fetched {dateLabel(data.fetchedAt)}. Cached observations,
                  not live sensors.
                </p>
              </>
            )}
            <footer className="sidebar-footer">
              <ShieldCheck size={15} />
              <p>
                Safety scores are estimates based on available infrastructure
                and mapping data. They do not guarantee personal safety.
              </p>
            </footer>
          </div>
        </aside>
        <section className="map-panel" aria-label="Journey map">
          <RouteMap
            panelExpanded={expanded}
            routes={data?.routes ?? []}
            selected={route?.id ?? ""}
            origin={origin}
            destination={destination}
            onPick={mapPick}
            onSelect={(id) => {
              if (!active) setSelected(id);
            }}
            location={location}
            recenter={recenter}
          />
          {pick && (
            <div role="status" className="pick-banner">
              Tap the map to set your {pick}.
              <button onClick={() => setPick(null)}>Cancel</button>
            </div>
          )}
          <button
            className="map-locate"
            aria-label="Recenter on my location"
            onClick={() => (location ? setRecenter((n) => n + 1) : locate())}
          >
            <LocateFixed size={20} />
          </button>
          <div className="map-attribution">
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              © OpenStreetMap
            </a>{" "}
            ·{" "}
            <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
              OpenFreeMap
            </a>
            {!demo && (
              <>
                {" "}
                ·{" "}
                <a
                  href="https://www.geoapify.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Powered by Geoapify
                </a>{" "}
                ·{" "}
                <a
                  href="https://openrouteservice.org"
                  target="_blank"
                  rel="noreferrer"
                >
                  openrouteservice
                </a>
              </>
            )}
          </div>
        </section>
      </div>
      <dialog
        ref={dialogRef}
        className="uber-dialog"
        onCancel={() => setUber(null)}
      >
        {uber && (
          <>
            <div className="section-heading">
              <h2>Review your Uber handoff</h2>
              <button
                className="icon-button"
                aria-label="Close Uber preview"
                onClick={() => setUber(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="muted">{uber.notice}</p>
            {uber.demo && (
              <p className="notice">
                Demo preview only. These fixtures are not verified stopping
                places.
              </p>
            )}
            <ol className="stop-list">
              <li>
                <small>PICKUP</small>
                {uber.origin.name}
              </li>
              {uber.stop && (
                <li>
                  <small>MANUAL INTERMEDIATE STOP</small>
                  {uber.stop.name}
                </li>
              )}
              <li>
                <small>DESTINATION</small>
                {uber.destination.name}
              </li>
            </ol>
            <p>
              SafarNav estimate: {(uber.distance / 1000).toFixed(1)} km ·{" "}
              {Math.ceil(uber.duration / 60)} min
              {uber.stop
                ? ` · ~${Math.ceil(uber.extraSeconds / 60)} min routing detour, plus stopping time`
                : ""}
              . Not an Uber ETA or fare.
            </p>
            {uber.options.length > 0 ? (
              <>
                <label>
                  Suggested public parking candidate
                  <select
                    value={stopId}
                    onChange={(e) => {
                      setStopId(e.target.value);
                      setConsent(false);
                      setUber({ ...uber, stop: null });
                    }}
                  >
                    <option value="">No intermediate stop</option>
                    {uber.options.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                {stopId && (
                  <>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => {
                          setConsent(e.target.checked);
                          if (!e.target.checked)
                            setUber({ ...uber, stop: null });
                        }}
                      />
                      I want this intermediate stop and understand I must add it
                      manually in Uber.
                    </label>
                    <button
                      className="secondary full"
                      disabled={!consent || uberBusy}
                      onClick={() => getUber(true)}
                    >
                      {uberBusy
                        ? "Checking driving access…"
                        : "Review and verify stop"}
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className="notice">
                No eligible public parking stop was found. No stop will be
                invented.
              </p>
            )}
            {uber.stop && (
              <div className="notice">
                <p>
                  {uber.verified
                    ? "Routing reachability checked; on-site stopping legality still needs your judgment."
                    : "Demo stop; not verified for real travel."}
                </p>
                <button
                  onClick={() =>
                    copy(
                      `${uber.stop!.name}: ${uber.stop!.coord[1]}, ${uber.stop!.coord[0]}`,
                    )
                  }
                >
                  <Copy size={14} /> Copy stop for manual entry
                </button>
              </div>
            )}
            <div className="button-row">
              <button
                className="secondary"
                onClick={() =>
                  copy(
                    `${uber.destination.name}: ${uber.destination.coord[1]}, ${uber.destination.coord[0]}`,
                  )
                }
              >
                Copy destination
              </button>
              {!uber.demo && (!stopId || !!uber.stop) && (
                <a
                  className="primary"
                  href={uber.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Uber <ExternalLink size={15} />
                </a>
              )}
            </div>
            <button className="text-button" onClick={share}>
              Copy SafarNav journey link
            </button>
          </>
        )}
      </dialog>
    </main>
  );
}
