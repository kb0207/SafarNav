import { beforeEach, afterEach, it, expect, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("OVERPASS_API_URL", "https://overpass.example/api/interpreter");
  vi.stubEnv("OVERPASS_USER_AGENT", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("identifies SafarNav and posts the encoded query in the body", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ elements: [] })));
  vi.stubGlobal("fetch", fetch);
  const { requestOverpass } = await import("@/lib/providers/overpass-client");
  await expect(requestOverpass("[out:json];node(1);out;")).resolves.toEqual({
    elements: [],
  });
  const options = fetch.mock.calls[0][1];
  expect(options.headers["User-Agent"]).toContain("SafarNav/1.0");
  expect(options.headers.Accept).toBe("application/json");
  expect(new URLSearchParams(options.body).get("data")).toBe(
    "[out:json];node(1);out;",
  );
});
it("supports an operator-supplied identity", async () => {
  vi.stubEnv("OVERPASS_USER_AGENT", "SafarNav/1.0 (+https://example.com)");
  const { overpassHeaders } = await import("@/lib/providers/overpass-client");
  expect(new Headers(overpassHeaders()).get("user-agent")).toBe(
    "SafarNav/1.0 (+https://example.com)",
  );
});
it.each([406, 429])(
  "does not retry HTTP %s and enforces provider cooldown",
  async (status) => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status, headers: { "Retry-After": "60" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const { requestOverpass } = await import("@/lib/providers/overpass-client");
    await expect(requestOverpass("query")).rejects.toThrow(
      /OpenStreetMap infrastructure/,
    );
    vi.advanceTimersByTime(31000);
    await expect(requestOverpass("query")).rejects.toThrow(/cooling down/);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30000);
    fetch.mockResolvedValue(new Response(JSON.stringify({ elements: [] })));
    await expect(requestOverpass("query")).resolves.toEqual({ elements: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);
it("coalesces simultaneous identical queries and serializes different ones", async () => {
  let complete!: (r: Response) => void;
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          complete = r;
        }),
    )
    .mockImplementation(() => Promise.resolve(new Response('{"elements":[]}')));
  vi.stubGlobal("fetch", fetch);
  const { requestOverpass } = await import("@/lib/providers/overpass-client");
  const a = requestOverpass("a"),
    duplicate = requestOverpass("a"),
    b = requestOverpass("b");
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(a).toBe(duplicate);
  complete(new Response('{"elements":[]}'));
  await Promise.all([a, b]);
  expect(fetch).toHaveBeenCalledTimes(2);
});
