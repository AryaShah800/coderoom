import { isRunErrorBody, type RunErrorBody, type RunRequest, type RunResult } from "./run-contract";

export type RunOutcome =
  | { ok: true; result: RunResult }
  | { ok: false; error: { code: RunErrorBody["error"]["code"] | "network" | "bad_response"; message: string } };

/** Calls the app's own /api/run route. The Judge0 key never reaches the browser. */
export async function requestRun(body: RunRequest, signal?: AbortSignal): Promise<RunOutcome> {
  let response: Response;
  try {
    response = await fetch(new URL("/api/run", window.location.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw error;
    return { ok: false, error: { code: "network", message: "Could not reach the server. Check your connection." } };
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // handled below
  }

  if (response.ok && json && typeof json === "object" && "status" in json) {
    return { ok: true, result: json as RunResult };
  }
  if (isRunErrorBody(json)) return { ok: false, error: json.error };
  return { ok: false, error: { code: "bad_response", message: `Unexpected response from the server (HTTP ${response.status}).` } };
}
