import { z } from "zod";
import { body, endpoint } from "@/lib/http";
import { unseal } from "@/lib/session";
import { preview } from "@/lib/uber";
export const runtime = "nodejs";
export const maxDuration = 30;
const schema = z.object({
  token: z.string().max(1800000),
  routeId: z.string().max(100),
  stopId: z.string().max(100).optional(),
  consent: z.boolean().default(false),
});
export async function POST(req: Request) {
  return endpoint(
    req,
    async () => {
      const i = await body(req, schema);
      return preview(unseal(i.token), i.routeId, i.stopId, i.consent);
    },
    10,
  );
}
