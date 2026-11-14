import { body, endpoint } from "@/lib/http";
import { tokenRequest } from "@/lib/validation";
import { unseal } from "@/lib/session";
import { evaluate } from "@/lib/services";
import { summarize } from "@/lib/ai";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(req: Request) {
  return endpoint(
    req,
    async () => {
      const input = await body(req, tokenRequest);
      return summarize(
        evaluate(unseal(input.token), input.departure, input.token),
      );
    },
    10,
  );
}
