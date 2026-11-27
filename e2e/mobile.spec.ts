import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { joinRoom } from "./helpers";

test.use({ viewport: { width: 375, height: 812 } });

test("room fits a phone with a usable editor and accessible controls", async ({ page }) => {
  await page.goto("/room/abcdefghjm");
  await joinRoom(page, "Mobile", "Teal");

  // Check the first visit, while the lifetime notice still takes up space.
  await expect(page.getByTestId("room-lifetime-notice")).toBeVisible();
  const editor = page.locator(".monaco-editor");
  const run = page.getByRole("button", { name: "Run", exact: true });
  await expect(editor).toBeVisible();
  await expect(editor).toBeInViewport();
  await expect.poll(() => editor.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(200);
  await expect(run).toBeVisible();
  await expect(run).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  for (const v of results.violations) console.log(`[axe] ${v.impact}: ${v.id} (${v.nodes.length}) ${v.help}`);
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
