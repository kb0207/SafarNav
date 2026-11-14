import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { createHash } from "node:crypto";
import { cache } from "@/lib/cache";
import type { RouteResponse } from "@/types";
const schema = z
  .object({
    recommendedRouteId: z.string().nullable(),
    headline: z.string().max(180),
    whyRecommended: z.array(z.string().max(400)).max(4),
    comparison: z.string().max(600),
  })
  .strict();
export type Summary = z.infer<typeof schema> & {
  source: "gemini" | "template";
};
export function fallback(data: RouteResponse): Summary {
  const top = data.routes[0];
  const assessed = data.routes.every((r) => r.hasInfrastructure);
  return {
    source: "template",
    recommendedRouteId: assessed ? top.id : null,
    headline: assessed
      ? `${top.name} has the highest infrastructure indicator`
      : "Your journey overview",
    whyRecommended: [
      ...(assessed ? [`Indicator ${Math.round(top.score)}/100.`] : []),
      `${top.name}: about ${Math.ceil(top.duration / 60)} minutes and ${(top.distance / 1000).toFixed(1)} km.`,
    ],
    comparison: assessed
      ? `${data.routes.length} available routes compared by infrastructure indicator, distance and travel time.`
      : `${data.routes.length} available routes, ordered by travel time.`,
  };
}

export async function summarize(data: RouteResponse): Promise<Summary> {
  const base = fallback(data);
  if (!process.env.GEMINI_API_KEY?.trim()) return base;
  const facts = data.routes.map((r) => ({
    id: r.id,
    score: r.hasInfrastructure ? Math.round(r.score) : null,
    minutes: Math.round(r.duration / 60),
    kilometres: +(r.distance / 1000).toFixed(1),
    factors: Object.fromEntries(
      Object.entries(r.factors)
        .filter(([, f]) => f.known)
        .map(([name, f]) => [name, { score: Math.round(f.score) }]),
    ),
  }));
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        "summary-v2",
        facts,
        data.departure,
        data.demo,
        base.recommendedRouteId,
        process.env.GEMINI_MODEL,
      ]),
    )
    .digest("hex");
  const hit = cache.get<Summary>(fingerprint);
  if (hit) return hit;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: JSON.stringify({
        facts,
        departure: data.departure,
        demo: data.demo,
        recommendedRouteId: base.recommendedRouteId,
      }),
      config: {
        httpOptions: { timeout: 12000 },
        maxOutputTokens: 900,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(schema),
        systemInstruction:
          "Write a concise useful route overview from the supplied facts only. Use exactly the supplied recommendedRouteId, including null. Discuss relative infrastructure strengths and travel-time tradeoffs; do not invent places, conditions, safety guarantees or camera operation. If demo is true, describe these as demo routes. Never discuss confidence, missing or insufficient data, evidence limits, cautions, warnings, score thresholds or formula details. Do not include numerical claims in prose; verified numbers are displayed separately. When scores are null, describe travel options only. Return the specified JSON.",
      },
    });
    const parsed = schema.parse(JSON.parse(result.text ?? ""));
    if (parsed.recommendedRouteId !== base.recommendedRouteId) throw Error();
    // Reject numerical additions rather than allow the explanation to change computed values.
    if (
      /\d|confidence|threshold|caution|warning|insufficient|limited evidence|data limit|guarantee|certainly safe|completely safe/i.test(
        [parsed.headline, ...parsed.whyRecommended, parsed.comparison].join(
          " ",
        ),
      )
    )
      throw Error();
    const output: Summary = { ...parsed, source: "gemini" };
    cache.set(fingerprint, output, 900000);
    return output;
  } catch {
    return base;
  }
}
