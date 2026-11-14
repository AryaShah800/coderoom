import { z } from "zod";
import { LANGUAGE_KEYS } from "./languages";

/** Shared between the browser and the /api/run route handler. */

export const MAX_SOURCE_CHARS = 50_000;
export const MAX_STDIN_CHARS = 10_000;
/** Raw request body cap, checked before JSON parsing (UTF-8 bytes). */
export const MAX_BODY_BYTES = 128 * 1024;
/** Each output stream is cut to this many characters before it is returned. */
export const MAX_OUTPUT_CHARS = 20_000;

export const runRequestSchema = z.strictObject({
  language: z.enum(LANGUAGE_KEYS),
  source: z
    .string()
    .max(MAX_SOURCE_CHARS, `Code must be at most ${MAX_SOURCE_CHARS.toLocaleString("en-US")} characters`)
    .refine((s) => s.trim().length > 0, "Code is empty"),
  stdin: z
    .string()
    .max(MAX_STDIN_CHARS, `Input must be at most ${MAX_STDIN_CHARS.toLocaleString("en-US")} characters`)
    .default(""),
});

export type RunRequest = z.input<typeof runRequestSchema>;

export interface RunResult {
  /** Judge0 status: 3 = Accepted, 4 = Wrong Answer, 5 = Time Limit Exceeded, 6 = Compilation Error, 7-12 = runtime errors, 13 = internal error. */
  status: { id: number; description: string };
  stdout: string;
  stderr: string;
  compileOutput: string;
  message: string;
  /** CPU time in seconds. */
  time: number | null;
  /** Peak memory in kilobytes. */
  memory: number | null;
  truncated: boolean;
}

export type RunErrorCode =
  | "invalid_json"
  | "invalid_request"
  | "unsupported_media_type"
  | "payload_too_large"
  | "forbidden_origin"
  | "rate_limited"
  | "not_configured"
  | "upstream_timeout"
  | "upstream_busy"
  | "upstream_error";

export interface RunErrorBody {
  error: { code: RunErrorCode; message: string };
}

export const isRunErrorBody = (value: unknown): value is RunErrorBody =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as RunErrorBody).error?.code === "string" &&
  typeof (value as RunErrorBody).error?.message === "string";

/** Judge0 status IDs 3 = Accepted; everything else is some kind of failure. */
export const isSuccessfulRun = (result: RunResult) => result.status.id === 3;
