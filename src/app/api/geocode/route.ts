import { endpoint, AppError } from "@/lib/http";
import { geocode } from "@/lib/providers/geocoding";
export async function GET(req: Request) {
  return endpoint(
    req,
    async () => {
      const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
      if (q.length < 2 || q.length > 120)
        throw new AppError(400, "Search text must contain 2–120 characters.");
      return { places: await geocode(q) };
    },
    60,
  );
}
