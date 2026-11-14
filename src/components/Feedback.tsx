"use client";
import { useState } from "react";
import type { ScoredRoute } from "@/types";
export default function Feedback({
  token,
  route,
  onClose,
}: {
  token: string;
  route: ScoredRoute;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [id] = useState(() => crypto.randomUUID());
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          routeId: route.id,
          submissionId: id,
          rating: Number(form.get("rating")),
          lighting: form.get("lighting"),
          activity: form.get("activity"),
          concern: form.get("concern"),
          comments: form.get("comments"),
          segmentId: form.get("segmentId") || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error.message);
      setMessage(data.message);
      setDone(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feedback">
      <span className="eyebrow">JOURNEY COMPLETE</span>
      <h2>How did your journey feel?</h2>
      <p className="muted">
        Optional and anonymous. Please don’t include personal details. Feedback
        stays separate from scores.
      </p>
      {!done && (
        <form onSubmit={submit}>
          <label>
            How safe did you feel?
            <select name="rating" defaultValue="3">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} —{" "}
                  {
                    [
                      "Very uneasy",
                      "Uneasy",
                      "Neutral",
                      "Comfortable",
                      "Very comfortable",
                    ][n - 1]
                  }
                </option>
              ))}
            </select>
          </label>
          <label>
            Streetlights
            <select name="lighting">
              <option value="unknown">Not sure</option>
              <option value="most">Yes, most of the route</option>
              <option value="some">Some sections</option>
              <option value="few">Very few</option>
            </select>
          </label>
          <label>
            Street activity
            <select name="activity">
              <option value="unknown">Not sure</option>
              <option value="busy">Busy</option>
              <option value="moderate">Moderately active</option>
              <option value="quiet">Mostly quiet</option>
            </select>
          </label>
          <label>
            Any concerning or poorly lit sections?
            <select name="concern">
              <option value="unknown">Not sure</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            Optional section
            <select name="segmentId">
              <option value="">No section selected</option>
              {route.segments.map((s, i) => (
                <option key={s.id} value={s.id}>
                  Section {i + 1} · {Math.round(s.start)} m from start
                </option>
              ))}
            </select>
          </label>
          <label>
            Comments
            <textarea
              name="comments"
              maxLength={1000}
              rows={3}
              placeholder="What should we know?"
            />
          </label>
          <button disabled={busy} className="primary full">
            {busy ? "Submitting…" : "Submit feedback"}
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <button className="text-button" onClick={onClose}>
        {done ? "Back to planning" : "Discard without saving"}
      </button>
    </section>
  );
}
