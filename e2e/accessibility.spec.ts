import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { joinRoom } from "./helpers";

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  // Print every finding so minor issues are visible in the log, not hidden.
  for (const v of results.violations) console.log(`[axe] ${v.impact}: ${v.id} (${v.nodes.length}) ${v.help}`);
  return blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("home page has no critical or serious axe violations", async ({ page }) => {
  await page.goto("/");
  expect(await scan(page)).toEqual([]);
});

test("join screen has no critical or serious axe violations", async ({ page }) => {
  await page.goto("/room/abcdefghjp");
  await expect(page.getByRole("heading", { name: "Join the room" })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test("workspace has no critical or serious axe violations", async ({ page }) => {
  await page.goto("/room/abcdefghjq");
  await joinRoom(page, "Axe", "Teal");
  expect(await scan(page)).toEqual([]);
});

test("keyboard: skip link and Run are reachable without a mouse", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();

  await page.goto("/room/abcdefghjr");
  await joinRoom(page, "Keys", "Pink");
  const run = page.getByRole("button", { name: "Run", exact: true });
  await page.getByLabel("Language").focus();
  await page.keyboard.press("Tab");
  await expect(run).toBeFocused();
});
