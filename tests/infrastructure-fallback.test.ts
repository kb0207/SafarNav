import { it, expect, vi, afterEach } from "vitest";
const providers = vi.hoisted(() => ({ overpass: vi.fn(), places: vi.fn() }));
vi.mock("@/lib/providers/overpass", () => ({
  getInfrastructure: providers.overpass,
}));
vi.mock("@/lib/providers/places", () => ({
  getPlacesInfrastructure: providers.places,
}));
import { loadInfrastructure } from "@/lib/providers/infrastructure";
import { AppError } from "@/lib/http";
import { demoSnapshot } from "@/lib/providers/demo";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("uses real fallback data and labels its missing evidence after an Overpass outage", async () => {
  vi.stubEnv("GEOCODING_API_KEY", "test");
  const s = demoSnapshot("walking");
  providers.overpass.mockRejectedValue(new AppError(504, "timeout"));
  providers.places.mockResolvedValue(s.infrastructure);
  const result = await loadInfrastructure(s.routes);
  expect(result.infrastructure).toEqual(s.infrastructure);
  expect(result.warnings.join(" ")).toContain("Geoapify");
  expect(result.warnings.join(" ")).toContain(
    "Road, street-light and surveillance data are unavailable",
  );
});
it("does not call the fallback when Overpass succeeds", async () => {
  providers.overpass.mockResolvedValue([]);
  expect(await loadInfrastructure([])).toEqual({
    infrastructure: [],
    warnings: [],
  });
  expect(providers.places).not.toHaveBeenCalled();
});
it("does not bypass geographic limits through the fallback", async () => {
  vi.stubEnv("GEOCODING_API_KEY", "test");
  providers.overpass.mockRejectedValue(new AppError(422, "too large"));
  await expect(loadInfrastructure([])).rejects.toThrow("too large");
  expect(providers.places).not.toHaveBeenCalled();
});
it("supports disabling fallback and reports total outage honestly", async () => {
  vi.stubEnv("GEOCODING_API_KEY", "test");
  vi.stubEnv("INFRASTRUCTURE_FALLBACK", "none");
  providers.overpass.mockRejectedValue(new AppError(504, "timeout"));
  await expect(loadInfrastructure([])).rejects.toThrow("timeout");
  expect(providers.places).not.toHaveBeenCalled();
  vi.stubEnv("INFRASTRUCTURE_FALLBACK", "geoapify");
  providers.places.mockRejectedValue(new Error());
  await expect(loadInfrastructure([])).rejects.toThrow(
    "Both infrastructure services",
  );
});
