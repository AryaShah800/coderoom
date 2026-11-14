// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("uses a sliding window per key", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 100).allowed).toBe(true);
    const blocked = limiter.check("a", 200);
    expect(blocked).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
    expect(limiter.check("b", 200).allowed).toBe(true);
    expect(limiter.check("a", 1001).allowed).toBe(true); // first hit left the window
  });

  it("forgets the least recently used keys beyond maxKeys", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000, maxKeys: 2 });
    limiter.check("a", 0);
    limiter.check("b", 0);
    limiter.check("c", 0); // evicts "a"
    expect(limiter.check("a", 1).allowed).toBe(true);
    expect(limiter.check("c", 1).allowed).toBe(false);
  });
});

describe("clientKey", () => {
  it("prefers the first x-forwarded-for address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientKey(new Headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientKey(new Headers())).toBe("anonymous");
  });
});
