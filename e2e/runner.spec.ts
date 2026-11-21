import { test, expect } from "@playwright/test";
import { joinRoom, expectEditorToContain } from "./helpers";

/** Solo room helper. */
async function soloRoom(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a room" }).click();
  await page.waitForURL(/\/room\//);
  await joinRoom(page, "Solo", "Green");
  await expectEditorToContain(page, "Hello, ${name}!");
}

test("TypeScript runs in the browser with types stripped", async ({ page }) => {
  await soloRoom(page);
  await page.getByLabel("Language").selectOption("typescript");
  await expectEditorToContain(page, "(name: string): string");
  await expect(page.getByTestId("runtime-note")).toContainText("Types are stripped, not type-checked");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("region", { name: "Output" })).toContainText("Hello, CodeRoom!");
});

test("Python runs through Pyodide, loaded lazily from the pinned CDN version", async ({ page }) => {
  test.setTimeout(100_000);
  const cdn: string[] = [];
  page.on("request", (r) => r.url().includes("cdn.jsdelivr.net") && cdn.push(r.url()));
  await soloRoom(page);
  // Opening a room never touches the CDN.
  expect(cdn).toEqual([]);

  await page.getByLabel("Language").selectOption("python");
  await expectEditorToContain(page, "def greet");
  await expect(page.getByTestId("runtime-note")).toContainText("Pyodide");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("region", { name: "Output" })).toContainText("Hello, CodeRoom!", { timeout: 55_000 });
  expect(cdn.length).toBeGreaterThan(0);
  expect(cdn.every((u) => u.includes("/pyodide/v0.27.7/"))).toBe(true);
});
