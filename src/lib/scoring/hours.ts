import OpeningHours from "opening_hours";
import tzlookup from "tz-lookup";
import { toZonedTime } from "date-fns-tz";
import type { Coord } from "@/types";
export function openingStatus(
  hours: string | undefined,
  at: Date,
  coord: Coord,
): "open" | "closed" | "unknown" {
  if (!hours) return "unknown";
  // Without reliable regional holiday metadata, PH/SH rules must remain uncertain.
  if (/\b(PH|SH)\b/.test(hours)) return "unknown";
  try {
    const wall = toZonedTime(at, tzlookup(coord[1], coord[0]));
    const rule = new OpeningHours(hours, {
      lat: coord[1],
      lon: coord[0],
      address: { country_code: "", state: "" },
    });
    return rule.getUnknown(wall)
      ? "unknown"
      : rule.getState(wall)
        ? "open"
        : "closed";
  } catch {
    return "unknown";
  }
}
