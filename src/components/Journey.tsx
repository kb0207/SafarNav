"use client";
import { useEffect, useRef, useState } from "react";
import { Navigation, Pause, Play, Flag, X } from "lucide-react";
import { sendJourneyNotification } from "@/lib/notifications";
import { trackingState } from "@/lib/geo/tracking";
import type { Coord, ScoredRoute } from "@/types";
export default function Journey({
  route,
  notificationStatus,
  onLocation,
  onFinish,
  onDiscard,
}: {
  route: ScoredRoute;
  notificationStatus: string;
  onLocation: (p: { coord: Coord; accuracy: number } | null) => void;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<ReturnType<typeof trackingState> | null>(
    null,
  );
  const [accuracy, setAccuracy] = useState(0);
  const [alert, setAlert] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [hidden, setHidden] = useState(false);
  const alerted = useRef(new Set<string>());
  const previous = useRef<Coord | null>(null);
  useEffect(() => {
    const listener = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, []);
  useEffect(() => {
    if (paused || hidden) return;
    if (!navigator.geolocation) {
      setTimeout(
        () => setError("Geolocation is unavailable in this browser."),
        0,
      );
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const raw: Coord = [p.coords.longitude, p.coords.latitude];
        const coord: Coord =
          previous.current && p.coords.accuracy > 20
            ? [
                previous.current[0] * 0.25 + raw[0] * 0.75,
                previous.current[1] * 0.25 + raw[1] * 0.75,
              ]
            : raw;
        previous.current = coord;
        onLocation({ coord, accuracy: p.coords.accuracy });
        setAccuracy(p.coords.accuracy);
        const next = trackingState(route, coord, p.coords.accuracy);
        setState(next);
        setError("");
        if (next.upcoming && !alerted.current.has(next.upcoming.id)) {
          alerted.current.add(next.upcoming.id);
          const message = `Heads up: a section scoring below 30/100 is within 250 m ahead (${Math.round(next.upcoming.length)} m long).`;
          setAlert(message);
          void sendJourneyNotification(message, `safarnav-${next.upcoming.id}`);
        }
      },
      (e) => setError(`${e.message} You can pause, retry or finish manually.`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [route, paused, hidden, onLocation]);
  return (
    <section className="journey-panel" aria-label="Active journey">
      <div className="section-heading">
        <h3>
          <Navigation size={17} />{" "}
          {paused ? "Journey paused" : "Journey in progress"}
        </h3>
        <button
          className="icon-button"
          aria-label="Discard journey"
          onClick={() => {
            onLocation(null);
            onDiscard();
          }}
        >
          <X size={17} />
        </button>
      </div>
      <p className="muted">
        Keep SafarNav open and in the foreground. Background GPS is not
        reliable.
      </p>
      {notificationStatus && (
        <p role="status" className="muted">
          {notificationStatus}
        </p>
      )}
      {hidden && (
        <p role="status">Monitoring suspended while this page is hidden.</p>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {state && (
        <>
          <div className="journey-stats">
            <strong>{(state.remaining / 1000).toFixed(1)} km left</strong>
            <span>
              ~{Math.ceil(state.seconds / 60)} min · GPS ±{Math.round(accuracy)}{" "}
              m
            </span>
          </div>
          <progress
            max={100}
            value={state.progress}
            aria-label="Journey progress"
          />
          {state.offRoute && (
            <p className="notice">
              You appear off route. Pause and recalculate when convenient.
            </p>
          )}
        </>
      )}
      {alert && (
        <div role="alert" className="notice">
          {alert}
          <button onClick={() => setAlert("")}>Dismiss</button>
        </div>
      )}
      <div className="button-row">
        <button className="secondary" onClick={() => setPaused(!paused)}>
          {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
          {paused ? "Resume" : "Pause"}
        </button>
        <button className="primary" onClick={() => setConfirm(true)}>
          <Flag size={16} /> I’ve arrived
        </button>
      </div>
      {confirm && (
        <div className="notice">
          <p>End GPS monitoring and finish this journey?</p>
          <div className="button-row">
            <button
              className="primary"
              onClick={() => {
                onLocation(null);
                onFinish();
              }}
            >
              Confirm arrival
            </button>
            <button className="secondary" onClick={() => setConfirm(false)}>
              Keep going
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
