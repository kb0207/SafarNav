import { endpoint, AppError } from "@/lib/http";
import { unseal } from "@/lib/session";
// Use the authenticated journey snapshot, never an unbounded public bounding-box query.
export async function GET(req: Request) {
  return endpoint(req, async () => {
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token || token.length > 1800000)
      throw new AppError(401, "A valid route session is required.");
    const s = unseal(token);
    return {
      pois: s.infrastructure.filter((p) => p.category !== "road"),
      fetchedAt: s.fetchedAt,
      demo: s.demo,
    };
  });
}
