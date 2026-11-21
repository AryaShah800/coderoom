// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const envNames = (path: string) =>
  [...read(path).matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]!);

describe("deploy configuration", () => {
  it("vercel.json is valid JSON for the Next.js app with the repo's build command", () => {
    const config = JSON.parse(read("vercel.json"));
    expect(config.framework).toBe("nextjs");
    expect(config.buildCommand).toBe("npm run build");
    expect(JSON.parse(read("package.json")).scripts.build).toContain("next build");
  });

  it("render.yaml deploys the sync server only, with a health check and a mandatory origin allowlist", () => {
    const yaml = read("render.yaml");
    expect(yaml).toMatch(/rootDir:\s*sync-server/);
    expect(yaml).toMatch(/startCommand:\s*npm start/);
    expect(yaml).toMatch(/healthCheckPath:\s*\/healthz/);
    expect(yaml).toMatch(/- key: ALLOWED_ORIGINS\s*\n\s*sync: false/);
    expect(JSON.parse(read("sync-server/package.json")).scripts.start).toBe("node src/index.js");
    // The health endpoint the platform polls exists in the server.
    expect(read("sync-server/src/server.js")).toContain("/healthz");
  });

  it("DEPLOY.md documents every variable in both .env.example files", () => {
    const doc = read("docs/DEPLOY.md");
    const names = [...envNames(".env.example"), ...envNames("sync-server/.env.example")];
    expect(names.length).toBeGreaterThan(8);
    for (const name of names) expect(doc, `${name} missing from docs/DEPLOY.md`).toContain(name);
  });

  it("states that nothing is deployed", () => {
    expect(read("docs/DEPLOY.md")).toContain("Nothing here has been deployed yet");
  });
});
