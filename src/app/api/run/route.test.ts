// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { server } from "@/test/msw";
import { runLimiter } from "@/lib/server/rate-limit";
import { MAX_BODY_BYTES, MAX_SOURCE_CHARS } from "@/lib/run-contract";

vi.mock("next/server", () => ({ connection: async () => {} }));

const { GET, POST } = await import("./route");

const JUDGE0 = "https://judge0.test";
let ip = 0;

function post(body: unknown, init: { headers?: Record<string, string>; raw?: string } = {}) {
  ip += 1; // fresh client per request so the rate limiter does not interfere unless a test wants it
  return new Request("http://localhost:3000/api/run", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${ip}`, host: "localhost:3000", ...init.headers },
    body: init.raw ?? JSON.stringify(body),
  });
}

const valid = { language: "javascript", source: "console.log(1)", stdin: "" };

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => runLimiter.reset());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("GET /api/run", () => {
  it("reports whether Judge0 is configured, without leaking the URL", async () => {
    vi.stubEnv("JUDGE0_URL", "");
    expect(await (await GET()).json()).toEqual({ configured: false });
    vi.stubEnv("JUDGE0_URL", JUDGE0);
    const body = await (await GET()).json();
    expect(body).toEqual({ configured: true });
    expect(JSON.stringify(body)).not.toContain("judge0.test");
  });
});

describe("POST /api/run: request validation", () => {
  beforeEach(() => vi.stubEnv("JUDGE0_URL", JUDGE0));

  it("rejects non-JSON content types", async () => {
    const res = await POST(post(valid, { headers: { "content-type": "text/plain" } }));
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe("unsupported_media_type");
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(post(null, { raw: "{nope" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_json");
  });

  it.each([
    [{ ...valid, language: "cobol" }, "language"],
    [{ ...valid, source: "   " }, "Code is empty"],
    [{ ...valid, source: "x".repeat(MAX_SOURCE_CHARS + 1) }, "at most"],
    [{ ...valid, stdin: 5 }, "stdin"],
    [{ ...valid, extra: true }, "extra"],
  ])("rejects invalid body %#", async (body, expected) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("invalid_request");
    expect(json.error.message).toContain(expected);
  });

  it("rejects bodies over the byte limit, by header or by actual size", async () => {
    const declared = await POST(post(valid, { headers: { "content-length": String(MAX_BODY_BYTES + 1) } }));
    expect(declared.status).toBe(413);

    const big = JSON.stringify({ ...valid, source: "é".repeat(MAX_BODY_BYTES) });
    const actual = await POST(post(null, { raw: big }));
    expect(actual.status).toBe(413);
    expect((await actual.json()).error.code).toBe("payload_too_large");
  });

  it("rejects cross-site browser requests", async () => {
    const res = await POST(post(valid, { headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/run: execution", () => {
  it("answers 503 not_configured when JUDGE0_URL is not set", async () => {
    vi.stubEnv("JUDGE0_URL", "");
    const res = await POST(post(valid));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.code).toBe("not_configured");
    expect(json.error.message).toContain("JUDGE0_URL");
  });

  it("returns the decoded Judge0 result", async () => {
    vi.stubEnv("JUDGE0_URL", JUDGE0);
    server.use(
      http.post(`${JUDGE0}/submissions`, () =>
        HttpResponse.json({
          stdout: Buffer.from("1\n").toString("base64"),
          status: { id: 3, description: "Accepted" },
          time: "0.02",
          memory: 1000,
        }),
      ),
    );
    const res = await POST(post(valid, { headers: { origin: "http://localhost:3000" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ status: { id: 3 }, stdout: "1\n", time: 0.02 });
  });

  it("maps a compile error to a normal result (not an HTTP error)", async () => {
    vi.stubEnv("JUDGE0_URL", JUDGE0);
    server.use(
      http.post(`${JUDGE0}/submissions`, () =>
        HttpResponse.json({
          compile_output: Buffer.from("main.c:1: error").toString("base64"),
          status: { id: 6, description: "Compilation Error" },
        }),
      ),
    );
    const res = await POST(post({ ...valid, language: "c" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: { id: 6 }, compileOutput: "main.c:1: error" });
  });

  it("answers 504 when Judge0 is too slow", async () => {
    vi.stubEnv("JUDGE0_URL", JUDGE0);
    vi.stubEnv("JUDGE0_TIMEOUT_MS", "1000");
    server.use(
      http.post(`${JUDGE0}/submissions`, async () => {
        await delay(4_000);
        return HttpResponse.json({});
      }),
    );
    const res = await POST(post(valid));
    expect(res.status).toBe(504);
    expect((await res.json()).error.code).toBe("upstream_timeout");
  });

  it("answers 502 when Judge0 fails", async () => {
    vi.stubEnv("JUDGE0_URL", JUDGE0);
    server.use(http.post(`${JUDGE0}/submissions`, () => new HttpResponse(null, { status: 500 })));
    const res = await POST(post(valid));
    expect(res.status).toBe(502);
  });
});

describe("POST /api/run: rate limiting", () => {
  it("allows 8 runs a minute per client, then answers 429 with Retry-After", async () => {
    vi.stubEnv("JUDGE0_URL", "");
    const request = () =>
      POST(
        new Request("http://localhost:3000/api/run", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
          body: JSON.stringify(valid),
        }),
      );
    for (let i = 0; i < 8; i++) expect((await request()).status).toBe(503);
    const limited = await request();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await limited.json()).error.code).toBe("rate_limited");

    // a different client is unaffected
    expect((await POST(post(valid))).status).toBe(503);
  });
});
