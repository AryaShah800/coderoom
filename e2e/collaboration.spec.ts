import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { editorText, expectEditorToContain, joinRoom, typeAtEnd } from "./helpers";

/** Two isolated browser contexts = two different people (separate storage, separate sockets). */
async function twoPeople(browser: Browser) {
  const contexts: BrowserContext[] = [await browser.newContext(), await browser.newContext()];
  const [asha, ben] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  const externalRequests: string[] = [];
  asha.on("request", (r) => {
    const url = r.url();
    if (!url.startsWith("http://localhost") && !url.startsWith("data:") && !url.startsWith("blob:")) externalRequests.push(url);
  });

  await asha.goto("/");
  await asha.getByRole("button", { name: "Create a room" }).click();
  await asha.waitForURL(/\/room\/[a-z0-9]{10}$/);
  const roomUrl = asha.url();

  await joinRoom(asha, "Asha", "Amber");
  await ben.goto(roomUrl);
  await joinRoom(ben, "Ben", "Sky");

  return { asha, ben, roomUrl, externalRequests, close: () => Promise.all(contexts.map((c) => c.close())) };
}

test.describe("two people in one room", () => {
  test("see each other, share edits both ways, and see remote cursors", async ({ browser }) => {
    const { asha, ben, externalRequests, close } = await twoPeople(browser);
    try {
      // Monaco is bundled from its ESM build and served by the app: nothing is fetched from a CDN.
      expect(externalRequests).toEqual([]);
      expect(await asha.evaluate(() => typeof (window as unknown as { monaco?: unknown }).monaco)).toBe("undefined");

      // Presence: both names appear in both participant lists.
      for (const page of [asha, ben]) {
        const people = page.getByRole("list", { name: /People in this room: 2/ });
        await expect(people).toContainText("Asha");
        await expect(people).toContainText("Ben");
      }
      await expect(asha.getByRole("list", { name: /People in this room/ })).toContainText("Asha (you)");

      // The new room was seeded once with the starter template, visible to both.
      await expectEditorToContain(asha, "Hello, ${name}!");
      await expectEditorToContain(ben, "Hello, ${name}!");

      // Asha -> Ben
      await typeAtEnd(asha, "// typed by Asha");
      await expectEditorToContain(ben, "// typed by Asha");

      // Ben -> Asha
      await typeAtEnd(ben, "// reply from Ben");
      await expectEditorToContain(asha, "// reply from Ben");

      // The template must not have been inserted twice.
      const text = await editorText(asha);
      expect(text.split('console.log(greet("CodeRoom"));').length - 1).toBe(1);

      // Ben's caret is drawn in Asha's editor with his name label (y-monaco + awareness).
      await expect(asha.locator(".monaco-editor [class*='yRemoteSelectionHead-']").first()).toBeAttached();
      const cursorCss = () => asha.getByTestId("remote-cursor-styles").evaluate((el) => el.textContent ?? "");
      await expect.poll(cursorCss).toContain('content:"Ben"');
      await expect.poll(cursorCss).toContain("#38bdf8");
    } finally {
      await close();
    }
  });

  test("language changes are shared and swap an untouched template", async ({ browser }) => {
    const { asha, ben, close } = await twoPeople(browser);
    try {
      await expectEditorToContain(ben, "Hello, ${name}!");
      await asha.getByLabel("Language").selectOption("python");
      await expect(ben.getByLabel("Language")).toHaveValue("python");
      await expectEditorToContain(ben, 'def greet(name: str) -> str:');
      // Ben's editor switched to Python highlighting: "def" is coloured as a keyword (theme amber),
      // which only happens when the Python tokenizer is active.
      const def = ben.locator(".monaco-editor .view-lines span span", { hasText: /^def$/ }).first();
      await expect(def).toHaveCSS("color", "rgb(245, 165, 36)");
    } finally {
      await close();
    }
  });

  test("a run result is shared with everyone in the room (Judge0 response mocked)", async ({ browser }) => {
    const { asha, ben, close } = await twoPeople(browser);
    try {
      await asha.route("**/api/run", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        const body = route.request().postDataJSON() as { language: string; source: string };
        expect(body.language).toBe("javascript");
        expect(body.source).toContain("greet");
        await route.fulfill({
          json: {
            status: { id: 3, description: "Accepted" },
            stdout: "Hello, CodeRoom!\n",
            stderr: "",
            compileOutput: "",
            message: "",
            time: 0.041,
            memory: 9216,
            truncated: false,
          },
        });
      });
      await expectEditorToContain(asha, "Hello, ${name}!");
      await asha.getByRole("button", { name: "Run", exact: true }).click();

      await expect(asha.getByRole("region", { name: "Output" })).toContainText("Hello, CodeRoom!");
      await expect(asha.getByText("Accepted", { exact: true })).toBeVisible();
      // Ben never called the API, but sees the same output via the shared Y.Doc.
      await expect(ben.getByRole("region", { name: "Output" })).toContainText("Hello, CodeRoom!");
      await expect(ben.getByText(/Asha, JavaScript/)).toBeVisible();
      await expect(ben.locator("p[role='status'][aria-live='polite']").filter({ hasText: "Asha's run finished" })).toBeAttached();
    } finally {
      await close();
    }
  });
});

test("Run reports honestly that Judge0 is not configured (real /api/run, no mock)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a room" }).click();
  await page.waitForURL(/\/room\//);
  await joinRoom(page, "Solo", "Green");

  await expect(page.getByText("This server has no Judge0 endpoint set")).toBeVisible();
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("Control+Enter");
  const alert = page.getByRole("alert").filter({ hasText: "Run is not configured here" });
  await expect(alert).toContainText("Run is not configured here");
  await expect(alert).toContainText("JUDGE0_URL");
});

test("the API route validates input and bounds the payload", async ({ request }) => {
  const bad = await request.post("/api/run", { data: { language: "cobol", source: "x" } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error.code).toBe("invalid_request");

  const huge = await request.post("/api/run", {
    data: { language: "python", source: "x".repeat(200 * 1024) },
  });
  expect(huge.status()).toBe(413);

  const status = await request.get("/api/run");
  expect(await status.json()).toEqual({ configured: false });
});

test("joining from a pasted link and rejecting malformed rooms", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Room code or link").fill("not a room");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "room code" })).toContainText("10-character room code");

  await page.getByLabel("Room code or link").fill("https://coderoom.example/room/abcdefghjk");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.waitForURL(/\/room\/abcdefghjk$/);
  await expect(page.getByText("Room abcdefghjk")).toBeVisible();

  const response = await page.goto("/room/NOT-VALID");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "That room does not exist" })).toBeVisible();
});

test("remembers the name on this device", async ({ page }) => {
  await page.goto("/room/abcdefghjm");
  await joinRoom(page, "Remembered", "Violet");
  await page.goto("/room/abcdefghjn");
  await expect(page.getByLabel("Your name")).toHaveValue("Remembered");
});
