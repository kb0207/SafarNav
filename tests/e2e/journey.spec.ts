import { test, expect } from "@playwright/test";
test("compare, rescore, explain, monitor and submit demo feedback", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation", "notifications"]);
  await context.setGeolocation({
    longitude: 77.2195,
    latitude: 28.6328,
    accuracy: 10,
  });
  await page.goto("/");
  await expect(page.getByText("DEMO EXPERIENCE")).toBeVisible();
  await expect(page.locator(".mode-toggle button").first()).toHaveText(
    "Driving",
  );
  await expect(
    page.getByRole("button", { name: "Driving", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Walking", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", { name: "Compare routes", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Route comparison" }),
  ).toBeVisible();
  await expect(page.locator(".route-card")).toHaveCount(3);
  await expect(page.locator(".place-marker")).toHaveCount(2, {
    timeout: 20000,
  });
  await expect(page.locator(".map-error")).toHaveCount(0);
  if (test.info().project.name === "mobile") {
    await expect
      .poll(async () => {
        const marker = await page
          .locator(".place-marker.destination")
          .boundingBox();
        const panel = await page.locator(".sidebar").boundingBox();
        return !!marker && !!panel && marker.y + marker.height < panel.y;
      })
      .toBe(true);
  }
  await page.screenshot({
    path: `test-results/preview-${test.info().project.name}.png`,
  });
  await page.locator(".route-card").nth(1).click();
  await expect(page.locator(".route-card").nth(1)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const time = page.getByRole("slider", { name: "Departure time offset" });
  await time.fill("720");
  await expect(page.getByText("Updating…")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Start journey", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Mapped security cameras", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByText(/% weight/)).toHaveCount(0);
  await page.getByText("Inspect individual sections", { exact: true }).click();
  await expect(page.getByText(/×.*%/)).toHaveCount(0);
  await expect(
    page.getByText("Section 1 ·", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Summary", exact: true }).click();
  await expect(
    page.getByText("COMPUTED SUMMARY", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".summary-result")).not.toContainText(
    /confidence|threshold|insufficient|limited evidence/i,
  );
  await expect(page.locator(".route-comparison")).not.toContainText(
    /confidence/i,
  );
  await expect(
    page.getByRole("region", { name: "Google Maps handoff" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start journey", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Active journey" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("Journey paused", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "I’ve arrived", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm arrival", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Submit feedback", exact: true })
    .click();
  await expect(
    page.getByText(
      "Demo feedback received for this session only. Nothing was stored.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("driving stop requires affirmative consent and stays a demo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Driving", exact: true }).click();
  await page
    .getByRole("button", { name: "Compare routes", exact: true })
    .click();
  await page
    .locator(".route-card")
    .filter({ hasText: "Garden avenue" })
    .click();
  await page
    .getByRole("button", { name: "Open this route in Uber", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Suggested public parking candidate")
    .selectOption("demo-parking");
  await expect(
    dialog.getByRole("button", { name: "Review and verify stop" }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Review and verify stop" }).click();
  await expect(
    dialog.getByText("MANUAL INTERMEDIATE STOP", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Open Uber" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close Uber preview" }).click();
  await expect(dialog).not.toBeVisible();
});
test("provider failure remains actionable without fabricating results", async ({
  page,
}) => {
  await page.route("**/api/routes", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Provider temporarily unavailable. Please retry." },
      }),
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Compare routes", exact: true })
    .click();
  await expect(page.locator(".notice.error")).toContainText(
    "Provider temporarily unavailable",
  );
  await expect(page.locator(".route-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Compare routes", exact: true }),
  ).toBeEnabled();
});

test("missing infrastructure keeps directions without a fabricated score", async ({
  page,
}) => {
  await page.route("**/api/routes", async (request) => {
    const response = await request.fetch();
    const data = await response.json();
    data.routes = data.routes
      .map((route: Record<string, unknown>) => ({
        ...route,
        hasInfrastructure: false,
        score: 50,
        confidence: 0,
        pois: [],
      }))
      .sort(
        (a: { duration: number }, b: { duration: number }) =>
          a.duration - b.duration,
      );
    data.warnings = ["Infrastructure is unavailable. Directions still work."];
    await request.fulfill({ response, json: data });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Compare routes", exact: true })
    .click();
  await expect(page.locator(".route-card")).toHaveCount(3);
  await expect(
    page.getByText("Ordered by travel time", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Score unavailable", { exact: true }),
  ).toHaveCount(3);
  await expect(
    page.getByText("HIGHEST INDICATOR", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".factor")).toHaveCount(0);
  await expect(page.getByText(/0 m of weak sections/)).toHaveCount(0);
  await page.locator(".route-card").nth(1).click();
  await expect(page.locator(".route-card").nth(1)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
