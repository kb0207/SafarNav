"use client";
import { useEffect, useState } from "react";
import type { Place } from "@/types";
export default function PlaceSearch({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value?.name ?? "");
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => {
    if (!focus || text.length < 2 || text === value?.name) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`, {
          signal: abort.signal,
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error.message);
        setPlaces(data.places);
        setError(
          data.places.length
            ? ""
            : "No Delhi/NCR places found. Try the full name or a nearby landmark.",
        );
      } catch (e) {
        if (!abort.signal.aborted) setError((e as Error).message);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [text, focus, value]);
  const display = focus ? text : (value?.name ?? text);
  return (
    <div className="place-search">
      <label>
        {label}
        <input
          aria-label={label}
          role="combobox"
          aria-expanded={focus && places.length > 0}
          aria-controls={`${label}-results`}
          aria-autocomplete="list"
          aria-activedescendant={
            focus && activeIndex >= 0
              ? `${label}-option-${activeIndex}`
              : undefined
          }
          autoComplete="off"
          disabled={disabled}
          value={display}
          placeholder={
            label === "From"
              ? "Start in Delhi / NCR"
              : "Destination in Delhi / NCR"
          }
          onFocus={() => {
            setText(value?.name ?? text);
            setFocus(true);
          }}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          onChange={(e) => {
            setText(e.target.value);
            setPlaces([]);
            setActiveIndex(-1);
            setError("");
            onChange(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setFocus(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(places.length - 1, i + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && places[activeIndex]) {
              e.preventDefault();
              const p = places[activeIndex];
              onChange(p);
              setText(p.name);
              setPlaces([]);
              setFocus(false);
            }
          }}
        />
      </label>
      {focus && (places.length > 0 || error) && (
        <div id={`${label}-results`} className="suggestions" role="listbox">
          {places.map((p, index) => (
            <button
              key={p.name}
              type="button"
              role="option"
              id={`${label}-option-${index}`}
              aria-selected={index === activeIndex}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(p);
                setText(p.name);
                setFocus(false);
                setPlaces([]);
              }}
            >
              {p.name}
            </button>
          ))}
          {error && <p role="status">{error}</p>}
        </div>
      )}
    </div>
  );
}
