import { describe, expect, it } from "vitest";
import { isBlockedIP, resolveSafeTlsConnectTarget } from "./url-allowed";

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

describe("isBlockedIP", () => {
  it.each([
    "0.0.0.0",
    "0.1.2.3",
    "127.0.0.1",
    "10.1.2.3",
    "100.64.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.0.8",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:10.0.0.1",
    "::127.0.0.1",
    "64:ff9b::a9fe:a9fe",
    "2002:7f00:1::",
    "fe80::1",
    "fe80::1%eth0",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedIP(ip)).toBe(true);
  });

  it.each([
    "1.1.1.1",
    "8.8.8.8",
    "100.128.0.1",
    "172.32.0.1",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
    "::ffff:8.8.8.8",
    "64:ff9b::808:808",
  ])("allows public address %s", (ip) => {
    expect(isBlockedIP(ip)).toBe(false);
  });
});

describe("resolveSafeTlsConnectTarget with IPv6 literals", () => {
  it("strips URL brackets and blocks mapped loopback", async () => {
    const r = await resolveSafeTlsConnectTarget(new URL("http://[::ffff:127.0.0.1]/").hostname);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("URL points to a disallowed address");
  });

  it("accepts a public IPv6 literal", async () => {
    const r = await resolveSafeTlsConnectTarget("[2606:4700:4700::1111]");
    expect(r).toEqual({ ok: true, connectHost: "2606:4700:4700::1111", servername: "2606:4700:4700::1111" });
  });
});
