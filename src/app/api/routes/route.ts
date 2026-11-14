import { body, endpoint } from "@/lib/http";
import { journey } from "@/lib/validation";
import { plan } from "@/lib/services";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  return endpoint(req, async () => plan(await body(req, journey)), 10);
}
