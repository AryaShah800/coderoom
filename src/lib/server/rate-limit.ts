import "server-only";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the oldest counted request leaves the window. */
  retryAfterSeconds: number;
}

/**
 * Sliding-window rate limiter kept in process memory.
 * Best effort: on serverless hosts each instance has its own window, so the real limit across
 * instances can be higher. Use a shared store (e.g. Redis) if strict limits are required.
 */
export function createRateLimiter({ limit, windowMs, maxKeys = 10_000 }: { limit: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - recent[0]!)) / 1000));
        return { allowed: false, remaining: 0, retryAfterSeconds };
      }
      recent.push(now);
      hits.delete(key);
      hits.set(key, recent);
      // Map keeps insertion order, so the first keys are the least recently used.
      while (hits.size > maxKeys) hits.delete(hits.keys().next().value!);
      return { allowed: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
    },
    reset() {
      hits.clear();
    },
  };
}

/** Client key for rate limiting. On Vercel, x-forwarded-for is set by the platform. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "anonymous";
}

/** Limiter used by /api/run: 8 runs per minute per client, per server instance. */
export const runLimiter = createRateLimiter({ limit: 8, windowMs: 60_000 });
