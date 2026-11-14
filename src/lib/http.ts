import { z } from "zod";
import { createHash } from "node:crypto";
import { cache } from "@/lib/cache";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}
export const isDemo = () => process.env.DEMO_MODE !== "false";
export function limit(key: string, max = 30) {
  const value = cache.get<number>(`rate:${key}`) ?? 0;
  if (value >= max)
    throw new AppError(
      429,
      "Too many requests. Please wait a minute.",
      "RATE_LIMIT",
    );
  cache.set(`rate:${key}`, value + 1, 60000);
}
export async function guard(req: Request, max = 30) {
  const origin = req.headers.get("origin");
  // Next.js can normalize req.url to localhost behind a proxy; Host is the incoming authority.
  const host = req.headers.get("host") ?? new URL(req.url).host;
  if (origin) {
    let allowed = false;
    try {
      const parsed = new URL(origin);
      allowed =
        parsed.host === host && ["http:", "https:"].includes(parsed.protocol);
    } catch {}
    if (!allowed)
      throw new AppError(
        403,
        "Cross-origin requests are not allowed.",
        "ORIGIN",
      );
  }
  const ip = process.env.VERCEL
    ? (req.headers.get("x-vercel-forwarded-for") ?? "unknown")
    : "local";
  limit(
    `${createHash("sha256").update(ip).digest("hex").slice(0, 16)}:${new URL(req.url).pathname}`,
    max,
  );
}
export async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new AppError(415, "Send JSON.");
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(400, "Missing request body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new AppError(413, "Request too large");
    }
    chunks.push(value);
  }
  try {
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString()));
  } catch {
    throw new AppError(
      400,
      "Invalid request. Check locations, departure time and form fields.",
      "VALIDATION",
    );
  }
}
export function errorResponse(error: unknown) {
  const e =
    error instanceof AppError
      ? error
      : new AppError(
          503,
          "This service is temporarily unavailable. Please retry.",
        );
  return Response.json(
    { error: { code: e.code, message: e.message } },
    { status: e.status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function endpoint(
  req: Request,
  fn: () => Promise<unknown>,
  max = 30,
) {
  try {
    await guard(req, max);
    return Response.json(await fn(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function providerFetch(
  url: string,
  init: RequestInit = {},
  timeout = 12000,
): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeout),
        cache: "no-store",
      });
      if (!r.ok) {
        if (r.status >= 500 && attempt === 0) continue;
        throw new AppError(
          r.status === 429 ? 429 : 502,
          `Geographic provider returned ${r.status}. Please retry later.`,
          "PROVIDER",
        );
      }
      return await r.json();
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (attempt === 1)
        throw new AppError(
          504,
          "Provider timed out or could not be reached.",
          "PROVIDER_TIMEOUT",
        );
    }
  }
  throw new AppError(502, "Provider unavailable");
}
