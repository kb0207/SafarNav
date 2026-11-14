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
import PlaceSearch from "@/components/PlaceSearch";
it("allows keyboard place selection without a mouse", async () => {
  const place = { name: "Central station", coord: [77.2, 28.6] };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ places: [place] }))),
  );
  const select = vi.fn();
  render(<PlaceSearch label="From" value={null} onChange={select} />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "Central" } });
  await waitFor(() => expect(screen.getByRole("option")).toBeInTheDocument());
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(input).toHaveAttribute("aria-activedescendant", "From-option-0");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(select).toHaveBeenLastCalledWith(place);
  cleanup();
  vi.unstubAllGlobals();
});
