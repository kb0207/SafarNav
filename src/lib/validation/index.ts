import { z } from "zod";
export const coord = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-85).max(85),
]);
export const place = z.object({
  name: z.string().trim().min(1).max(180),
  coord,
});
export const departure = z.iso
  .datetime({ offset: true })
  .refine(
    (s) => Math.abs(new Date(s).getTime() - Date.now()) < 48 * 3600000,
    "Choose a departure within 48 hours of now",
  );
export const journey = z.object({
  origin: place,
  destination: place,
  mode: z.enum(["walking", "driving"]),
  departure,
});
export const tokenRequest = z.object({
  token: z.string().min(1).max(1800000),
  departure,
});
export const feedback = z.object({
  token: z.string().min(1).max(1800000),
  routeId: z.string().max(100),
  rating: z.number().int().min(1).max(5),
  lighting: z.enum(["most", "some", "few", "unknown"]),
  activity: z.enum(["busy", "moderate", "quiet", "unknown"]),
  concern: z.enum(["yes", "no", "unknown"]),
  comments: z
    .string()
    .trim()
    .max(1000)
    .transform((s) => s.replace(/[<>\x00-\x08\x0e-\x1f]/g, "")),
  submissionId: z.uuid(),
  segmentId: z.string().max(100).optional(),
});
