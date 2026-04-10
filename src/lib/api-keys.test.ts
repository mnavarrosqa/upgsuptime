import { describe, expect, it } from "vitest";
import {
  buildCorsHeaders,
  createApiKeyToken,
  enforceApiRateLimit,
  isOriginAllowed,
  parseCorsOriginsInput,
  parseCorsOriginsStored,
  parseTokenPrefix,
} from "@/lib/api-keys";

describe("api-keys helpers", () => {
  it("generates token with prefix and parseable prefix", () => {
    const generated = createApiKeyToken();
    expect(generated.token.startsWith("upg_live_")).toBe(true);
    expect(generated.keyPrefix.startsWith("upg_live_")).toBe(true);
    expect(parseTokenPrefix(generated.token)).toBe(generated.keyPrefix);
    expect(generated.keyHash).toHaveLength(64);
  });

  it("normalizes and validates cors origins", () => {
    const origins = parseCorsOriginsInput([
      "https://Example.com/path",
      "http://localhost:3000",
      "ftp://invalid.com",
      "not-a-url",
      "https://example.com",
    ]);
    expect(origins).toEqual(["https://example.com", "http://localhost:3000"]);
    expect(parseCorsOriginsStored(JSON.stringify(origins))).toEqual(origins);
    expect(parseCorsOriginsStored("bad-json")).toEqual([]);
  });

  it("checks allowed origin and builds headers", () => {
    const allowed = ["https://dashboard.example.com"];
    expect(isOriginAllowed("https://dashboard.example.com", allowed)).toBe(true);
    expect(isOriginAllowed("https://evil.example.com", allowed)).toBe(false);
    const headers = buildCorsHeaders("https://dashboard.example.com");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://dashboard.example.com");
    expect(headers.Vary).toBe("Origin");
  });

  it("rejects malformed tokens and rate limits repeated calls", () => {
    expect(parseTokenPrefix("bad-token")).toBeNull();
    const keyId = `key-${Date.now()}`;
    let blocked = false;
    for (let i = 0; i < 150; i += 1) {
      const result = enforceApiRateLimit(keyId);
      if (!result.ok) {
        blocked = true;
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
        break;
      }
    }
    expect(blocked).toBe(true);
  });
});
