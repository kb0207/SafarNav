import { body, endpoint } from "@/lib/http";
import { feedback } from "@/lib/validation";
import { saveFeedback } from "@/lib/db";
export const runtime = "nodejs";
export async function POST(req: Request) {
  return endpoint(req, async () => saveFeedback(await body(req, feedback)), 5);
}
