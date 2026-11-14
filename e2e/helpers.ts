import { expect, type Page } from "@playwright/test";

/** Joins the room the page is on, with the given name and colour (by accessible colour name). */
export async function joinRoom(page: Page, name: string, colorName: string) {
  await expect(page.getByRole("heading", { name: "Join the room" })).toBeVisible();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("radio", { name: colorName }).check({ force: true });
  await page.getByRole("button", { name: "Join room" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Connection:" })).toContainText("Live");
  await expect(page.locator(".monaco-editor .view-lines")).toBeVisible();
}

/** Visible editor text, with Monaco's non-breaking spaces normalised. */
export async function editorText(page: Page) {
  const text = await page.locator(".monaco-editor .view-lines").innerText();
  return text.replace(/ /g, " ");
}

export async function expectEditorToContain(page: Page, snippet: string) {
  await expect.poll(() => editorText(page), { timeout: 15_000 }).toContain(snippet);
}

/** Puts the caret at the end of the document and types `text` on a new line. */
export async function typeAtEnd(page: Page, text: string) {
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(text);
}
