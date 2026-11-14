import { it, expect, vi, afterEach } from "vitest";
const writes = vi.hoisted(() => ({
  insert: vi.fn(),
  values: vi.fn().mockResolvedValue(undefined),
  batch: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn() }));
vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: () => ({
    insert: writes.insert.mockImplementation(() => ({ values: writes.values })),
    batch: writes.batch,
  }),
}));
import { saveFeedback } from "@/lib/db";
import { seal } from "@/lib/session";
import { demoSnapshot } from "@/lib/providers/demo";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("writes validated feedback with a coarse region and no raw geometry", async () => {
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("SESSION_SECRET", "test-secret");
  vi.stubEnv("DATABASE_URL", "postgres://test");
  const s = demoSnapshot("walking");
  s.demo = false;
  const token = seal(s);
  const result = await saveFeedback({
    token,
    routeId: "demo-0",
    rating: 4,
    lighting: "most",
    activity: "moderate",
    concern: "no",
    comments: "A test observation",
    submissionId: crypto.randomUUID(),
  });
  expect(result.saved).toBe(true);
  const value = writes.values.mock.calls[0][0];
  expect(value.region).toMatch(/^\d+\.\d{2},\d+\.\d{2}$/);
  expect(value).not.toHaveProperty("geometry");
  expect(value).not.toHaveProperty("token");
  expect(value.journeyHash).toHaveLength(64);
});
it("database failure does not falsely report a save", async () => {
  vi.stubEnv("DEMO_MODE", "false");
  vi.stubEnv("SESSION_SECRET", "test-secret");
  vi.stubEnv("DATABASE_URL", "postgres://test");
  const s = demoSnapshot("walking");
  s.demo = false;
  writes.values.mockRejectedValueOnce(new Error("unavailable"));
  await expect(
    saveFeedback({
      token: seal(s),
      routeId: "demo-0",
      rating: 4,
      lighting: "most",
      activity: "moderate",
      concern: "no",
      comments: "",
      submissionId: crypto.randomUUID(),
    }),
  ).rejects.toThrow(/Could not save/);
});
