import "server-only";
import { getLanguage, type LanguageKey } from "../languages";
import { MAX_OUTPUT_CHARS, type RunErrorCode, type RunResult } from "../run-contract";

export interface Judge0Config {
  baseUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
}

/**
 * Reads Judge0 settings from server-only environment variables. Returns null when execution
 * is not configured, so the route can answer with an honest "configuration required" error.
 *
 * - JUDGE0_URL: base URL, e.g. a self-hosted http://localhost:2358 or https://judge0-ce.p.rapidapi.com
 * - JUDGE0_AUTH_TOKEN: X-Auth-Token for a self-hosted instance with AUTHN enabled (optional)
 * - JUDGE0_RAPIDAPI_KEY + JUDGE0_RAPIDAPI_HOST: for the hosted RapidAPI plan (optional)
 * - JUDGE0_TIMEOUT_MS: upstream timeout, default 15000, clamped to 1000-30000
 */
export function readJudge0Config(env: NodeJS.ProcessEnv = process.env): Judge0Config | null {
  const raw = env.JUDGE0_URL?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (env.JUDGE0_AUTH_TOKEN) headers["X-Auth-Token"] = env.JUDGE0_AUTH_TOKEN;
  if (env.JUDGE0_RAPIDAPI_KEY) {
    headers["X-RapidAPI-Key"] = env.JUDGE0_RAPIDAPI_KEY;
    headers["X-RapidAPI-Host"] = env.JUDGE0_RAPIDAPI_HOST || url.host;
  }

  const timeout = Number(env.JUDGE0_TIMEOUT_MS ?? 15_000);
  const timeoutMs = Number.isFinite(timeout) ? Math.min(30_000, Math.max(1_000, timeout)) : 15_000;

  return { baseUrl: url.toString().replace(/\/+$/, ""), headers, timeoutMs };
}

export class Judge0Error extends Error {
  constructor(
    readonly code: Extract<RunErrorCode, "upstream_timeout" | "upstream_busy" | "upstream_error">,
    message: string,
  ) {
    super(message);
    this.name = "Judge0Error";
  }
}

/** Limits sent with every submission (Judge0 units: seconds and kilobytes). */
export const SUBMISSION_LIMITS = {
  cpu_time_limit: 5,
  wall_time_limit: 10,
  memory_limit: 256_000,
} as const;

const toBase64 = (text: string) => Buffer.from(text, "utf8").toString("base64");

const fromBase64 = (value: unknown): string => {
  if (typeof value !== "string" || value === "") return "";
  return Buffer.from(value, "base64").toString("utf8");
};

function cap(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_OUTPUT_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_OUTPUT_CHARS), truncated: true };
}

const toNumber = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Maps a raw Judge0 submission (base64 fields) to the public RunResult shape. */
export function toRunResult(raw: Record<string, unknown>): RunResult {
  const status = raw.status as { id?: unknown; description?: unknown } | undefined;
  const fields = [raw.stdout, raw.stderr, raw.compile_output, raw.message].map((v) => cap(fromBase64(v)));
  const [stdout, stderr, compileOutput, message] = fields as [
    { text: string; truncated: boolean },
    { text: string; truncated: boolean },
    { text: string; truncated: boolean },
    { text: string; truncated: boolean },
  ];
  return {
    status: {
      id: typeof status?.id === "number" ? status.id : 13,
      description: typeof status?.description === "string" ? status.description : "Unknown status",
    },
    stdout: stdout.text,
    stderr: stderr.text,
    compileOutput: compileOutput.text,
    message: message.text,
    time: toNumber(raw.time),
    memory: toNumber(raw.memory),
    truncated: fields.some((f) => f.truncated),
  };
}

/**
 * Submits code to Judge0 and waits for the result (`wait=true`), with a hard timeout.
 * Throws Judge0Error for timeouts, rate limiting and upstream failures.
 */
export async function runOnJudge0(
  config: Judge0Config,
  input: { language: LanguageKey; source: string; stdin: string },
  fetchImpl: typeof fetch = fetch,
): Promise<RunResult> {
  const url = `${config.baseUrl}/submissions?base64_encoded=true&wait=true&fields=stdout,stderr,compile_output,message,status,time,memory`;
  const body = JSON.stringify({
    language_id: getLanguage(input.language).judge0Id,
    source_code: toBase64(input.source),
    stdin: toBase64(input.stdin),
    ...SUBMISSION_LIMITS,
  });

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: config.headers,
      body,
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new Judge0Error("upstream_timeout", "The code runner did not answer in time. Try again in a moment.");
    }
    throw new Judge0Error("upstream_error", "Could not reach the code runner.");
  }

  if (response.status === 429) {
    throw new Judge0Error("upstream_busy", "The code runner is busy (its rate limit was reached). Try again shortly.");
  }
  if (!response.ok) {
    throw new Judge0Error("upstream_error", `The code runner returned an error (HTTP ${response.status}).`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Judge0Error("upstream_error", "The code runner sent a response that could not be read.");
  }
  if (typeof json !== "object" || json === null || typeof (json as { status?: unknown }).status !== "object") {
    throw new Judge0Error("upstream_error", "The code runner sent an unexpected response.");
  }
  return toRunResult(json as Record<string, unknown>);
}
