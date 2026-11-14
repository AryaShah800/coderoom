// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/test/msw";
import { Judge0Error, readJudge0Config, runOnJudge0, SUBMISSION_LIMITS, toRunResult } from "./judge0";
import { MAX_OUTPUT_CHARS } from "../run-contract";

const BASE = "https://judge0.test";
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const config = { baseUrl: BASE, headers: { "Content-Type": "application/json", "X-Auth-Token": "t0ken" }, timeoutMs: 1000 };

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("readJudge0Config", () => {
  it("returns null when JUDGE0_URL is missing or invalid", () => {
    expect(readJudge0Config({} as NodeJS.ProcessEnv)).toBeNull();
    expect(readJudge0Config({ JUDGE0_URL: "  " } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(readJudge0Config({ JUDGE0_URL: "not a url" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(readJudge0Config({ JUDGE0_URL: "ftp://x" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("builds auth headers for self-hosted and RapidAPI setups and clamps the timeout", () => {
    const selfHosted = readJudge0Config({
      JUDGE0_URL: "http://localhost:2358/",
      JUDGE0_AUTH_TOKEN: "abc",
      JUDGE0_TIMEOUT_MS: "999999",
    } as unknown as NodeJS.ProcessEnv);
    expect(selfHosted).toMatchObject({ baseUrl: "http://localhost:2358", timeoutMs: 30_000 });
    expect(selfHosted?.headers["X-Auth-Token"]).toBe("abc");

    const rapid = readJudge0Config({
      JUDGE0_URL: "https://judge0-ce.p.rapidapi.com",
      JUDGE0_RAPIDAPI_KEY: "key",
    } as unknown as NodeJS.ProcessEnv);
    expect(rapid?.headers["X-RapidAPI-Key"]).toBe("key");
    expect(rapid?.headers["X-RapidAPI-Host"]).toBe("judge0-ce.p.rapidapi.com");
    expect(rapid?.timeoutMs).toBe(15_000);
  });
});

describe("runOnJudge0", () => {
  it("sends base64 code with limits and decodes the result", async () => {
    let sent: Record<string, unknown> = {};
    let url = "";
    let token: string | null = null;
    server.use(
      http.post(`${BASE}/submissions`, async ({ request }) => {
        url = request.url;
        token = request.headers.get("x-auth-token");
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          stdout: b64("héllo\n"),
          stderr: null,
          compile_output: null,
          message: null,
          status: { id: 3, description: "Accepted" },
          time: "0.012",
          memory: 3200,
        });
      }),
    );

    const result = await runOnJudge0(config, { language: "python", source: 'print("héllo")', stdin: "in" });

    expect(url).toContain("base64_encoded=true");
    expect(url).toContain("wait=true");
    expect(token).toBe("t0ken");
    expect(sent).toMatchObject({ language_id: 71, source_code: b64('print("héllo")'), stdin: b64("in"), ...SUBMISSION_LIMITS });
    expect(result).toEqual({
      status: { id: 3, description: "Accepted" },
      stdout: "héllo\n",
      stderr: "",
      compileOutput: "",
      message: "",
      time: 0.012,
      memory: 3200,
      truncated: false,
    });
  });

  it("maps upstream 429 to a busy error and other failures to upstream errors", async () => {
    server.use(http.post(`${BASE}/submissions`, () => new HttpResponse(null, { status: 429 })));
    await expect(runOnJudge0(config, { language: "c", source: "x", stdin: "" })).rejects.toMatchObject({ code: "upstream_busy" });

    server.use(http.post(`${BASE}/submissions`, () => new HttpResponse("boom", { status: 500 })));
    await expect(runOnJudge0(config, { language: "c", source: "x", stdin: "" })).rejects.toMatchObject({
      code: "upstream_error",
      message: expect.stringContaining("HTTP 500"),
    });

    server.use(http.post(`${BASE}/submissions`, () => HttpResponse.json({ nope: true })));
    await expect(runOnJudge0(config, { language: "c", source: "x", stdin: "" })).rejects.toBeInstanceOf(Judge0Error);

    server.use(http.post(`${BASE}/submissions`, () => HttpResponse.error()));
    await expect(runOnJudge0(config, { language: "c", source: "x", stdin: "" })).rejects.toMatchObject({ code: "upstream_error" });
  });

  it("gives up after the timeout", async () => {
    server.use(
      http.post(`${BASE}/submissions`, async () => {
        await delay(5_000);
        return HttpResponse.json({});
      }),
    );
    const started = Date.now();
    await expect(runOnJudge0(config, { language: "c", source: "x", stdin: "" })).rejects.toMatchObject({ code: "upstream_timeout" });
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});

describe("toRunResult", () => {
  it("caps very long output and flags it", () => {
    const result = toRunResult({ stdout: b64("x".repeat(MAX_OUTPUT_CHARS + 50)), status: { id: 3, description: "Accepted" } });
    expect(result.stdout).toHaveLength(MAX_OUTPUT_CHARS);
    expect(result.truncated).toBe(true);
  });

  it("tolerates a missing status", () => {
    expect(toRunResult({}).status).toEqual({ id: 13, description: "Unknown status" });
  });
});
