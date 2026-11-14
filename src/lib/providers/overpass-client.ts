import { AppError } from "@/lib/http";

const inFlight = new Map<string, Promise<unknown>>();
const cooldowns = new Map<string, number>();
let queue: Promise<void> = Promise.resolve();

// Identify the application honestly. Do not impersonate a browser or rotate UAs.
export function overpassHeaders(): HeadersInit {
  return {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    "User-Agent":
      process.env.OVERPASS_USER_AGENT?.trim() ||
      "SafarNav/1.0 (OSM infrastructure route planner)",
  };
}

export function requestOverpass(query: string): Promise<unknown> {
  const url =
    process.env.OVERPASS_API_URL?.trim() ||
    "https://overpass-api.de/api/interpreter";
  const key = JSON.stringify([url, query]);
  const existing = inFlight.get(key);
  if (existing) return existing;
  // Serialize this process's Overpass requests and coalesce identical queries.
  const request = queue.then(async () => {
    if ((cooldowns.get(url) ?? 0) > Date.now()) {
      throw new AppError(
        503,
        "The infrastructure service is cooling down. Please wait at least 30 seconds before comparing routes again.",
        "INFRASTRUCTURE_COOLDOWN",
      );
    }
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: overpassHeaders(),
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(22000),
        cache: "no-store",
      });
    } catch (error) {
      cooldowns.set(url, Date.now() + 30000);
      const timeout =
        error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name);
      throw new AppError(
        504,
        timeout
          ? "OpenStreetMap infrastructure timed out. Directions are still available."
          : "The connection to OpenStreetMap infrastructure failed. Directions are still available.",
        timeout ? "INFRASTRUCTURE_TIMEOUT" : "INFRASTRUCTURE_NETWORK",
      );
    }
    if (!response.ok) {
      // No immediate retry or mirror rotation after access/rate rejection.
      if ([403, 406, 429, 502, 503, 504].includes(response.status)) {
        const retry = response.headers.get("retry-after");
        const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : 0;
        const until = retry && !seconds ? Date.parse(retry) : 0;
        cooldowns.set(
          url,
          Math.max(
            Date.now() + 30000,
            Date.now() + seconds * 1000,
            Number.isFinite(until) ? until : 0,
          ),
        );
      }
      await response.body?.cancel();
      const message =
        response.status === 406 || response.status === 403
          ? "OpenStreetMap infrastructure access was rejected. Wait at least 30 seconds and retry; if it persists, the server operator must review provider access. Route directions remain available."
          : `OpenStreetMap infrastructure is temporarily unavailable (HTTP ${response.status}). Please retry after 30 seconds.`;
      throw new AppError(503, message, "INFRASTRUCTURE_PROVIDER");
    }
    try {
      return await response.json();
    } catch {
      throw new AppError(
        502,
        "OpenStreetMap infrastructure returned an unreadable response. Please retry shortly.",
        "INFRASTRUCTURE_RESPONSE",
      );
    }
  });
  queue = request.then(
    () => undefined,
    () => undefined,
  );
  const tracked = request.finally(() => inFlight.delete(key));
  inFlight.set(key, tracked);
  return tracked;
}
