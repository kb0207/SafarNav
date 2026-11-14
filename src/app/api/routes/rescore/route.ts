import { body, endpoint } from "@/lib/http";
import { tokenRequest } from "@/lib/validation";
import { unseal } from "@/lib/session";
import { evaluate } from "@/lib/services";
export const runtime = "nodejs";
export async function POST(req: Request) {
  return endpoint(
    req,
    async () => {
      const input = await body(req, tokenRequest);
      return evaluate(unseal(input.token), input.departure, input.token);
    },
    90,
  );
}
