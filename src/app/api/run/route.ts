import { connection } from "next/server";
import { clientKey, runLimiter } from "@/lib/server/rate-limit";
import { Judge0Error, readJudge0Config, runOnJudge0 } from "@/lib/server/judge0";
import { MAX_BODY_BYTES, runRequestSchema, type RunErrorBody, type RunErrorCode, type RunResult } from "@/lib/run-contract";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(status: number, code: RunErrorCode, message: string, headers: Record<string, string> = {}) {
  const body: RunErrorBody = { error: { code, message } };
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/** Reads the body as text but stops once it exceeds `limit` bytes, whatever Content-Length claims. */
async function readBounded(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Rejects cross-site browser requests; requests without an Origin header (curl, tests) pass. */
function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request)) {
    return fail(403, "forbidden_origin", "Cross-site requests are not allowed.");
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return fail(415, "unsupported_media_type", "Send the request as application/json.");
  }

  const limit = runLimiter.check(clientKey(request.headers));
  if (!limit.allowed) {
    return fail(429, "rate_limited", `Too many runs. Try again in ${limit.retryAfterSeconds} s.`, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const text = await readBounded(request, MAX_BODY_BYTES);
  if (text === null) {
    return fail(413, "payload_too_large", `Request is larger than ${MAX_BODY_BYTES / 1024} KB.`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail(400, "invalid_json", "Request body is not valid JSON.");
  }

  const parsed = runRequestSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    return fail(400, "invalid_request", `${where}${first?.message ?? "Invalid request"}`);
  }

  const config = readJudge0Config();
  if (!config) {
    return fail(
      503,
      "not_configured",
      "Code execution is not configured on this server. Set JUDGE0_URL (and a key if your Judge0 needs one) to enable Run.",
    );
  }

  try {
    const result: RunResult = await runOnJudge0(config, parsed.data);
    return Response.json(result, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof Judge0Error) {
      const status = error.code === "upstream_timeout" ? 504 : error.code === "upstream_busy" ? 503 : 502;
      return fail(status, error.code, error.message);
    }
    console.error("[api/run] unexpected error", error);
    return fail(502, "upstream_error", "Something went wrong while running the code.");
  }
}

/** Lets the UI say up front whether Run is available. Never exposes the URL or keys. */
export async function GET(): Promise<Response> {
  await connection(); // read the environment at request time, not at build time
  return Response.json({ configured: readJudge0Config() !== null }, { headers: NO_STORE });
}
