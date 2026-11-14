import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { createHash } from "node:crypto";
import { z } from "zod";
import { feedback } from "@/lib/validation";
import { unseal } from "@/lib/session";
import { AppError } from "@/lib/http";
import { journeyFeedback, segmentObservations } from "./schema";
export async function saveFeedback(input: z.infer<typeof feedback>) {
  const snapshot = unseal(input.token);
  const route = snapshot.routes.find((r) => r.id === input.routeId);
  if (!route) throw new AppError(400, "Unknown route.");
  if (snapshot.demo)
    return {
      saved: false,
      demo: true,
      message:
        "Demo feedback received for this session only. Nothing was stored.",
    };
  if (!process.env.DATABASE_URL)
    throw new AppError(
      503,
      "Feedback storage is not configured. Your journey was not saved.",
    );
  const db = drizzle(neon(process.env.DATABASE_URL));
  const p =
    route.geometry.coordinates[
      Math.floor(route.geometry.coordinates.length / 2)
    ];
  const region = `${p[1].toFixed(2)},${p[0].toFixed(2)}`;
  const values = {
    id: input.submissionId,
    journeyHash: createHash("sha256").update(input.token).digest("hex"),
    region,
    mode: snapshot.mode,
    rating: input.rating,
    lighting: input.lighting,
    activity: input.activity,
    concern: input.concern,
    comments: input.comments,
  };
  // Batch is transactional in Neon HTTP. Coarse cells only; never store raw routes.
  try {
    if (input.segmentId) {
      const { scoreRoute } = await import("@/lib/scoring/engine");
      const s = scoreRoute(
        route,
        snapshot.infrastructure,
        snapshot.mode,
        snapshot.fetchedAt,
      ).segments.find((s) => s.id === input.segmentId);
      if (!s) throw new AppError(400, "Unknown section.");
      const c = s.geometry.coordinates[0];
      await db.batch([
        db.insert(journeyFeedback).values(values),
        db
          .insert(segmentObservations)
          .values({
            feedbackId: input.submissionId,
            coarseCell: `${c[1].toFixed(2)},${c[0].toFixed(2)}`,
            concern: input.concern,
          }),
      ]);
    } else await db.insert(journeyFeedback).values(values);
  } catch (e) {
    if (e instanceof AppError) throw e;
    const code = e as { code?: string; cause?: { code?: string } };
    if (code.code === "23505" || code.cause?.code === "23505")
      return {
        saved: true,
        duplicate: true,
        message: "Feedback was already received.",
      };
    throw new AppError(
      503,
      "Could not save feedback. You can retry or discard it.",
    );
  }
  return {
    saved: true,
    message:
      "Thank you. Your anonymous feedback was saved separately from route scores.",
  };
}
