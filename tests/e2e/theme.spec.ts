import { test, expect } from "@playwright/test";

// Check rendered colors rather than merely asserting that a theme class exists.
async function contrast(
  page: import("@playwright/test").Page,
  selectors: string[],
) {
  return page.evaluate((selectors) => {
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
    const luminance = (color: number[]) =>
      color.slice(0, 3).reduce((sum, value, i) => {
        const channel = value / 255;
        return (
          sum +
          (channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4) *
            [0.2126, 0.7152, 0.0722][i]
        );
      }, 0);
    return selectors.map((selector) => {
      const element = document.querySelector(selector)!;
      if (!element) throw new Error(`Missing contrast target: ${selector}`);
      let ancestor: Element | null = element;
      let background = [255, 255, 255];
      while (ancestor) {
        const candidate = rgb(getComputedStyle(ancestor).backgroundColor);
        if (candidate.length === 3 || candidate[3] === 1) {
          background = candidate;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      const foreground = luminance(rgb(getComputedStyle(element).color));
      const back = luminance(background);
      return {
        selector,
        ratio:
          (Math.max(foreground, back) + 0.05) /
          (Math.min(foreground, back) + 0.05),
      };
    });
  }, selectors);
}

test("both themes retain readable branding, body text, icons and route details", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle dark theme" });
  for (const dark of [false, true]) {
    if (dark) await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", String(dark));
    for (const result of await contrast(page, [
      ".brand > span:last-child",
      ".brand-accent",
      ".brand small",
      ".intro h1",
      ".intro h1 span",
      ".intro > p",
      ".time-machine h2",
      ".departure strong",
      ".departure > span",
      ".primary",
      ".mode-toggle .selected",
      ".place-search input",
      ".sidebar-footer p",
    ])) {
      expect(
        result.ratio,
        `${dark ? "dark" : "light"} ${result.selector}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    for (const result of await contrast(page, [
      '[aria-label="Toggle dark theme"] svg',
      ".departure svg",
    ]))
      expect(result.ratio, result.selector).toBeGreaterThanOrEqual(3);
    await page.screenshot({
      path: `test-results/${dark ? "dark" : "beige"}-header-${testInfo.project.name}.png`,
    });
  }
  await page
    .getByRole("button", { name: "Compare routes", exact: true })
    .click();
  await expect(page.locator(".route-card")).toHaveCount(3);
  for (const result of await contrast(page, [
    ".route-card.active h3",
    ".route-card.active .route-card-footer",
    ".score strong",
    ".details > summary",
    ".details .muted",
    ".factor > span",
  ]))
    expect(result.ratio, result.selector).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({
    path: `test-results/dark-${testInfo.project.name}.png`,
  });
  for (const result of await contrast(page, [".journey-actions .primary"]))
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  await page
    .getByRole("button", { name: "Start journey", exact: true })
    .click();
  for (const dark of [true, false]) {
    if (!dark) await toggle.click();
    for (const result of await contrast(page, [
      ".journey-panel .primary",
      ".journey-panel .secondary",
    ]))
      expect(
        result.ratio,
        `${dark ? "dark" : "light"} ${result.selector}`,
      ).toBeGreaterThanOrEqual(4.5);
  }
  await expect(page.locator("main")).not.toHaveClass(/dark/);
});
