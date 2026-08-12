import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("scan rate limiter", () => {
  it("allows a small burst and then blocks", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(rateLimit(key).allowed).toBe(true);
    const blocked = rateLimit(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
