import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { expectEditorToContain, joinRoom, typeAtEnd } from "./helpers";

test("the room says plainly that rooms are temporary, and Export file saves the shared code", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a room" }).click();
  await page.waitForURL(/\/room\/([a-z0-9]{10})$/);
  const roomId = page.url().split("/").pop()!;
  await joinRoom(page, "Solo", "Green");
  await expectEditorToContain(page, "Hello, ${name}!");
  await typeAtEnd(page, "// saved from the room");

  const notice = page.getByTestId("room-lifetime-notice");
  await expect(notice).toContainText("memory only");
  await expect(notice).toContainText("30 minutes");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export file" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`coderoom-${roomId}.js`);
  const saved = await readFile((await download.path())!, "utf8");
  expect(saved).toContain('console.log(greet("CodeRoom"));');
  expect(saved).toContain("// saved from the room");
});
