// @vitest-environment jsdom
import React from "react";
import { it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Feedback from "@/components/Feedback";
import { demoSnapshot } from "@/lib/providers/demo";
import { scoreRoute } from "@/lib/scoring/engine";
it("keeps feedback available after a failed save and permits discarding", async () => {
  const s = demoSnapshot("walking");
  const route = scoreRoute(
    s.routes[0],
    s.infrastructure,
    "walking",
    new Date().toISOString(),
  );
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "Storage unavailable" } }),
          { status: 503 },
        ),
      ),
  );
  const close = vi.fn();
  render(<Feedback token="test" route={route} onClose={close} />);
  fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("Storage unavailable"),
  );
  expect(screen.getByRole("button", { name: "Submit feedback" })).toBeEnabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Discard without saving" }),
  );
  expect(close).toHaveBeenCalledOnce();
  cleanup();
  vi.unstubAllGlobals();
});
