// Records the two-window demo GIF (docs/demo.gif) from the real app.
//
// Prerequisites: `npm run build`, then in two terminals start
//   node sync-server/src/index.js           (ws://127.0.0.1:1234)
//   npx next start -p 3100
// and have ffmpeg on PATH. Run: node scripts/record-demo.mjs
// Use PW_CHANNEL=msedge to drive an installed Edge instead of Playwright's Chromium.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3100";
const OUT = process.env.DEMO_OUT ?? "docs/demo.gif";
const FRAMES = process.env.DEMO_FRAMES_DIR ?? "demo-frames";
const W = 1024;
const H = 600;

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
const ctxA = await browser.newContext({ viewport: { width: W, height: H } });
const ctxB = await browser.newContext({ viewport: { width: W, height: H } });
const asha = await ctxA.newPage();
const ben = await ctxB.newPage();

const join_ = async (page, name, color) => {
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("radio", { name: color }).check({ force: true });
  await page.getByRole("button", { name: "Join room" }).click();
  await page.locator(".monaco-editor .view-lines").waitFor();
  await page.getByRole("status").filter({ hasText: "Connection:" }).filter({ hasText: "Live" }).waitFor();
};

let n = 0;
let recording = false;
const loop = async () => {
  while (recording) {
    const i = String(n++).padStart(3, "0");
    await Promise.all([
      asha.screenshot({ path: join(FRAMES, `a${i}.png`) }),
      ben.screenshot({ path: join(FRAMES, `b${i}.png`) }),
    ]);
  }
};
const hold = (ms) => asha.waitForTimeout(ms);

await asha.goto(BASE + "/");
await asha.getByRole("button", { name: "Create a room" }).click();
await asha.waitForURL(/\/room\//);
await join_(asha, "Asha", "Amber");
await ben.goto(asha.url());
await join_(ben, "Ben", "Sky");
await asha.locator(".monaco-editor .view-lines").getByText("Hello, ").first().waitFor();
await ben.locator(".monaco-editor .view-lines").getByText("Hello, ").first().waitFor();

recording = true;
const recorder = loop();
await hold(1200);

// Ben types a comment; Asha sees it live, with his caret label and "is typing".
await ben.locator(".monaco-editor .view-lines").click();
await ben.keyboard.press("Control+End");
await ben.keyboard.press("Enter");
await ben.keyboard.type("// Ben: hi Asha, I am editing too", { delay: 45 });
await hold(1500);

// Asha adds a line of code in the same file.
await asha.locator(".monaco-editor .view-lines").click();
await asha.keyboard.press("Control+End");
await asha.keyboard.press("Enter");
await asha.keyboard.type('console.log("two windows, one file");', { delay: 45 });
await hold(1200);

// Asha runs it in the browser; both windows show the same output.
await asha.getByRole("button", { name: "Run", exact: true }).click();
await asha.getByRole("region", { name: "Output" }).getByText("two windows, one file").waitFor();
await hold(2600);

recording = false;
await recorder;
await browser.close();

const frames = readdirSync(FRAMES).filter((f) => f.startsWith("a")).length;
console.log(`captured ${frames} frames per window`);
mkdirSync("docs", { recursive: true });
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-framerate",
    "7",
    "-i",
    join(FRAMES, "a%03d.png"),
    "-framerate",
    "7",
    "-i",
    join(FRAMES, "b%03d.png"),
    "-filter_complex",
    "[0][1]hstack=inputs=2,scale=1400:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4",
    OUT,
  ],
  { stdio: "inherit" },
);
rmSync(FRAMES, { recursive: true, force: true });
console.log(`${OUT}: ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
