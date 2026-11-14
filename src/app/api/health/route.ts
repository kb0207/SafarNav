import { isDemo } from "@/lib/http";
export async function GET() {
  return Response.json({
    status: "ok",
    demo: isDemo(),
    configured: {
      routing: !!process.env.ORS_API_KEY,
      geocoding: !!process.env.GEOCODING_API_KEY,
      map: !!process.env.NEXT_PUBLIC_MAP_STYLE_URL,
      ai: !!process.env.GEMINI_API_KEY,
      feedback: !!process.env.DATABASE_URL,
      session: !!process.env.SESSION_SECRET,
    },
    note: "Configuration check only; external service connectivity not tested.",
  });
}
