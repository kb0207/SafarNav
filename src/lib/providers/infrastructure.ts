import { AppError } from "@/lib/http";
import { getInfrastructure } from "./overpass";
import { getPlacesInfrastructure } from "./places";
import type { Infrastructure, Route } from "@/types";
export async function loadInfrastructure(
  routes: Route[],
): Promise<{ infrastructure: Infrastructure[]; warnings: string[] }> {
  let primaryError: unknown;
  try {
    return { infrastructure: await getInfrastructure(routes), warnings: [] };
  } catch (e) {
    primaryError = e;
  }
  // Invalid/oversized requests must not bypass bounds by trying a second provider.
  if (primaryError instanceof AppError && primaryError.status === 422)
    throw primaryError;
  if (
    process.env.INFRASTRUCTURE_FALLBACK !== "none" &&
    process.env.GEOCODING_API_KEY
  ) {
    try {
      return {
        infrastructure: await getPlacesInfrastructure(routes),
        warnings: [
          "Limited infrastructure coverage: using real OpenStreetMap-derived places via Geoapify because Overpass is unavailable. Road, street-light and surveillance data are unavailable; unknown factors stay neutral. This is a capped sample, not a complete inventory.",
        ],
      };
    } catch {
      throw new AppError(
        503,
        "Both infrastructure services are unavailable. Directions still work; safety indicators cannot be assessed. Please compare routes again later.",
        "INFRASTRUCTURE_UNAVAILABLE",
      );
    }
  }
  throw primaryError;
}
