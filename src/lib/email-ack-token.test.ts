import { describe, expect, it, beforeAll } from "vitest";
import { signEmailAckToken, verifyEmailAckToken } from "./email-ack-token";

describe("email-ack-token", () => {
  beforeAll(() => {
    process.env.EMAIL_ACK_SECRET = "unit-test-email-ack-secret";
  });

  it("roundtrips monitor id and episode ms", () => {
    const mid = "550e8400-e29b-41d4-a716-446655440000";
    const episodeMs = 1_700_000_000_000;
    const token = signEmailAckToken(mid, episodeMs);
    const v = verifyEmailAckToken(token);
    expect(v).not.toBeNull();
    expect(v?.monitorId).toBe(mid);
    expect(v?.episodeMs).toBe(episodeMs);
  });

  it("rejects tampered token", () => {
    const token = signEmailAckToken("550e8400-e29b-41d4-a716-446655440000", 123);
    expect(verifyEmailAckToken(`${token}x`)).toBeNull();
  });
});
