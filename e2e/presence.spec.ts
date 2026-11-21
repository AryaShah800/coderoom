import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { editorText, expectEditorToContain, joinRoom, typeAtEnd } from "./helpers";

async function twoPeople(browser: Browser, names: [string, string] = ["Asha", "Ben"]) {
  const contexts: BrowserContext[] = [await browser.newContext(), await browser.newContext()];
  const [asha, ben] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  await asha.goto("/");
  await asha.getByRole("button", { name: "Create a room" }).click();
  await asha.waitForURL(/\/room\/[a-z0-9]{10}$/);
  await joinRoom(asha, names[0], "Amber");
  await ben.goto(asha.url());
  await joinRoom(ben, names[1], "Sky");
  await expect(asha.getByRole("list", { name: /People in this room: 2/ })).toBeVisible();
  return { asha, ben, close: () => Promise.all(contexts.map((c) => c.close())) };
}

/** Computed opacity of a remote caret's name label (a ::after pseudo-element). */
const labelOpacity = (page: Page) =>
  page.locator(".monaco-editor [class*='yRemoteSelectionHead-']").first().evaluate((el) => getComputedStyle(el, "::after").opacity);

test.describe("presence", () => {
  test("a collaborator's name label shows while they move or type, then fades so it never covers text", async ({ browser }) => {
    const { asha, ben, close } = await twoPeople(browser);
    try {
      await expectEditorToContain(ben, "Hello, ${name}!");
      await typeAtEnd(ben, "// Ben is here");
      await expect(asha.locator(".monaco-editor [class*='yRemoteSelectionHead-']").first()).toBeAttached();
      await expect.poll(() => labelOpacity(asha)).toBe("1");
      // After the idle window (2.5 s) the label is invisible; the caret itself stays.
      await expect.poll(() => labelOpacity(asha), { timeout: 10_000 }).toBe("0");
      await expect(asha.locator(".monaco-editor [class*='yRemoteSelectionHead-']").first()).toBeAttached();
      // Moving again brings it back.
      await ben.keyboard.press("ArrowLeft");
      await expect.poll(() => labelOpacity(asha)).toBe("1");
    } finally {
      await close();
    }
  });

  test("a typing indicator appears while someone types and clears when they stop", async ({ browser }) => {
    const { asha, ben, close } = await twoPeople(browser);
    try {
      await expectEditorToContain(ben, "Hello, ${name}!");
      await typeAtEnd(ben, "typing now");
      await expect(asha.getByTestId("typing-indicator")).toContainText("Ben is typing");
      await expect(asha.getByTestId("typing-indicator")).toHaveCount(0, { timeout: 10_000 });
      // The typist does not see an indicator for themselves.
      await expect(ben.getByTestId("typing-indicator")).toHaveCount(0);
    } finally {
      await close();
    }
  });

  test("following a collaborator scrolls to their cursor until you stop", async ({ browser }) => {
    const { asha, ben, close } = await twoPeople(browser);
    try {
      await expectEditorToContain(ben, "Hello, ${name}!");
      // Ben pastes a long block, so his caret ends far below Asha's viewport.
      await ben.locator(".monaco-editor .view-lines").click();
      await ben.keyboard.press("Control+End");
      const block = Array.from({ length: 120 }, (_, i) => `// filler line ${i + 1}`).join("\n");
      await ben.keyboard.insertText(`\n${block}\n// BEN-END`);
      await expect.poll(() => editorText(ben)).toContain("// BEN-END");
      // Asha has not scrolled: she still sees the top and not Ben's end.
      expect(await editorText(asha)).not.toContain("// BEN-END");

      await asha.getByRole("button", { name: "Follow Ben" }).click();
      await expect(asha.getByTestId("follow-banner")).toContainText("Following Ben");
      await expect(asha.getByRole("button", { name: "Follow Ben" })).toHaveAttribute("aria-pressed", "true");
      await expectEditorToContain(asha, "// BEN-END");

      // While following, a further move of Ben's caret keeps her view with him.
      await ben.keyboard.type("\n// BEN-MORE");
      await expectEditorToContain(asha, "// BEN-MORE");

      await asha.getByRole("button", { name: "Stop following" }).click();
      await expect(asha.getByTestId("follow-banner")).toHaveCount(0);
      // Ben jumps back to the top; Asha, no longer following, stays at the bottom.
      await ben.keyboard.press("Control+Home");
      await ben.keyboard.type("// BEN-TOP ");
      await expect.poll(() => editorText(asha)).not.toContain("// BEN-TOP");
    } finally {
      await close();
    }
  });

  test("two people with the same name get distinguishable labels", async ({ browser }) => {
    const { asha, ben, close } = await twoPeople(browser, ["Sam", "Sam"]);
    try {
      for (const page of [asha, ben]) {
        const people = page.getByRole("list", { name: /People in this room: 2/ });
        await expect(people).toContainText("Sam (2)");
      }
      await expect
        .poll(() => asha.getByTestId("remote-cursor-styles").evaluate((el) => el.textContent ?? ""))
        .toMatch(/content:"Sam( \(2\))?"/);
    } finally {
      await close();
    }
  });
});
