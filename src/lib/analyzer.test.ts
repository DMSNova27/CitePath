import { describe, expect, it } from "vitest";
import { scanWebsite } from "./analyzer";

describe("website analyzer safety", () => {
  it("rejects localhost", async () => {
    await expect(scanWebsite("http://localhost:3000")).rejects.toThrow(/private|local/i);
  });

  it("rejects loopback IPv4", async () => {
    await expect(scanWebsite("http://127.0.0.1")).rejects.toThrow(/private|local/i);
  });

  it("rejects URLs with credentials", async () => {
    await expect(scanWebsite("https://user:password@example.com")).rejects.toThrow(/credentials/i);
  });

  it("rejects unsupported protocols", async () => {
    await expect(scanWebsite("ftp://example.com")).rejects.toThrow(/HTTP and HTTPS/i);
  });
});
