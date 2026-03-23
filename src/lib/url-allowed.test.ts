import { describe, expect, it } from "vitest";
import { resolveSafeTlsConnectTarget } from "./url-allowed";

describe("resolveSafeTlsConnectTarget", () => {
  it("blocks loopback IP", async () => {
    const r = await resolveSafeTlsConnectTarget("127.0.0.1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("URL points to a disallowed address");
  });

  it("blocks localhost hostname", async () => {
    const r = await resolveSafeTlsConnectTarget("localhost");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("URL hostname is not allowed");
  });

  it("blocks private 10.x", async () => {
    const r = await resolveSafeTlsConnectTarget("10.0.0.1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("URL points to a disallowed address");
  });
});
