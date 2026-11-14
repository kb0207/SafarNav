import { it, expect, vi, afterEach } from "vitest";
const generate = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: generate };
  },
}));
import { summarize } from "@/lib/ai";
import { demoSnapshot } from "@/lib/providers/demo";
import { evaluate } from "@/lib/services";
afterEach(() => vi.unstubAllEnvs());
it("rejects Gemini JSON that adds or overwrites scores", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test");
  const data = evaluate(demoSnapshot("walking"), new Date().toISOString());
  data.demo = false;
  const scores = data.routes.map((r) => r.score);
  generate.mockResolvedValue({
    text: JSON.stringify({
      recommendedRouteId: data.routes[0].id,
      headline: "Guaranteed safe",
      whyRecommended: [],
      comparison: "",
      score: 100,
    }),
  });
  const result = await summarize(data);
  expect(result.source).toBe("template");
  expect(data.routes.map((r) => r.score)).toEqual(scores);
});
it("rejects nonexistent route recommendations", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test");
  const data = evaluate(demoSnapshot("driving"), new Date().toISOString());
  data.demo = false;
  generate.mockResolvedValue({
    text: JSON.stringify({
      recommendedRouteId: "fake",
      headline: "Take this route",
      whyRecommended: [],
      comparison: "",
    }),
  });
  expect((await summarize(data)).source).toBe("template");
});
it("survives an unavailable Gemini service", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test");
  const data = evaluate(demoSnapshot("walking"), new Date().toISOString());
  data.demo = false;
  generate.mockRejectedValue(new Error("unavailable"));
  expect((await summarize(data)).source).toBe("template");
});
it("uses Gemini with a configured key and never exposes rejected summary language", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test");
  vi.stubEnv("GEMINI_MODEL", "summary-filter-test");
  const data = evaluate(demoSnapshot("driving"), new Date().toISOString());
  data.demo = false;
  const valid = {
    recommendedRouteId: data.routes[0].id,
    headline: "A clearer route choice",
    whyRecommended: ["This option has stronger mapped infrastructure."],
    comparison: "Compare the journey time with the alternatives.",
  };
  for (const text of [
    "Data confidence is high",
    "Below the threshold",
    "Insufficient data",
    "Limited evidence caps this estimate",
  ]) {
    generate.mockResolvedValue({
      text: JSON.stringify({ ...valid, comparison: text }),
    });
    const result = await summarize(data);
    expect(result.source).toBe("template");
    expect(JSON.stringify(result)).not.toMatch(
      /confidence|threshold|insufficient|limited evidence/i,
    );
  }
  generate.mockResolvedValue({ text: JSON.stringify(valid) });
  const result = await summarize(data);
  expect(result.source).toBe("gemini");
  expect(result.headline).toBe(valid.headline);
});
it("asks Gemini for a travel overview when infrastructure is unavailable", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test");
  const data = evaluate(demoSnapshot("walking"), new Date().toISOString());
  data.routes.forEach((r) => {
    r.hasInfrastructure = false;
  });
  generate.mockResolvedValue({
    text: JSON.stringify({
      recommendedRouteId: null,
      headline: "Your travel options",
      whyRecommended: ["Review journey times before leaving."],
      comparison: "The first option has the shortest travel time.",
    }),
  });
  expect((await summarize(data)).source).toBe("gemini");
});
