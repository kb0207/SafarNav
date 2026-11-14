import {
  DELHI_FILTER,
  DELHI_CENTER,
  inDelhiRegion,
  regionalQuery,
} from "@/lib/geo/region";
import { z } from "zod";
import { AppError, isDemo, providerFetch } from "@/lib/http";
import { demoPlaces } from "./demo";
import { cache } from "@/lib/cache";
import type { Place } from "@/types";
const response = z.object({
  features: z
    .array(
      z.object({
        properties: z.object({
          formatted: z.string(),
          lon: z.number().min(-180).max(180),
          lat: z.number().min(-85).max(85),
        }),
      }),
    )
    .max(20),
});
export async function geocode(query: string): Promise<Place[]> {
  if (isDemo())
    return demoPlaces.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()),
    );
  if ((process.env.GEOCODING_PROVIDER ?? "geoapify") !== "geoapify")
    throw new AppError(
      503,
      "Only the Geoapify geocoding adapter is configured.",
    );
  if (!process.env.GEOCODING_API_KEY)
    throw new AppError(
      503,
      "Set GEOCODING_API_KEY for Geoapify autocomplete, or select points on the map.",
    );
  query = regionalQuery(query);
  const key = `geocode:delhi-v2:${query.toLowerCase()}`;
  const hit = cache.get<Place[]>(key);
  if (hit) return hit;
  const url = new URL(
    process.env.GEOCODING_API_URL ??
      "https://api.geoapify.com/v1/geocode/autocomplete",
  );
  url.search = new URLSearchParams({
    text: query,
    apiKey: process.env.GEOCODING_API_KEY,
    limit: "10",
    filter: DELHI_FILTER,
    bias: `proximity:${DELHI_CENTER.join(",")}`,
    lang: "en",
  }).toString();
  const data = response.parse(await providerFetch(url.toString()));
  // Full-text lookup can find landmarks that address autocomplete misses.
  if (data.features.length < 3 && url.hostname === "api.geoapify.com") {
    const search = new URL(url);
    search.pathname = "/v1/geocode/search";
    try {
      data.features.push(
        ...response.parse(await providerFetch(search.toString())).features,
      );
    } catch {
      /* Keep usable autocomplete results if the secondary lookup fails. */
    }
  }
  const places: Place[] = data.features.map((f) => ({
    name: f.properties.formatted,
    coord: [f.properties.lon, f.properties.lat],
  }));
  const unique = [
    ...new Map(
      places
        .filter((p) => inDelhiRegion(p.coord))
        .map((p) => [p.coord.map((n) => n.toFixed(5)).join(","), p]),
    ).values(),
  ].slice(0, 10);
  cache.set(key, unique, unique.length ? 1800000 : 30000);
  return unique;
}
