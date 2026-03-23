import tls from "tls";
import { describe, expect, it } from "vitest";
import { evaluatePeerCertificate } from "./check-ssl";

describe("evaluatePeerCertificate", () => {
  const base = () => ({
    subject: { CN: "example.com" },
    issuer: { CN: "test" },
    valid_from: "Jan 1 00:00:00 2020 GMT",
    valid_to: "Jan 1 00:00:00 2030 GMT",
  });

  it("returns empty cert error when valid_to missing", () => {
    const r = evaluatePeerCertificate({} as tls.PeerCertificate, true, null);
    expect(r.valid).toBe(false);
    expect(r.error).toBe("No peer certificate received");
  });

  it("returns not yet valid", () => {
    const now = Date.parse("2025-01-01T00:00:00Z");
    const cert = {
      ...base(),
      valid_from: "Jan 1 00:00:00 2026 GMT",
      valid_to: "Jan 1 00:00:00 2030 GMT",
    } as tls.PeerCertificate;
    const r = evaluatePeerCertificate(cert, false, new Error("cert"), now);
    expect(r.valid).toBe(false);
    expect(r.error).toBe("Certificate not yet valid");
  });

  it("returns expired before trust message", () => {
    const now = Date.parse("2031-01-01T00:00:00Z");
    const cert = {
      ...base(),
      valid_from: "Jan 1 00:00:00 2020 GMT",
      valid_to: "Jan 1 00:00:00 2030 GMT",
    } as tls.PeerCertificate;
    const r = evaluatePeerCertificate(cert, false, new Error("expired"), now);
    expect(r.valid).toBe(false);
    expect(r.error).toBe("Certificate expired");
  });

  it("returns trust error when dates ok but not authorized", () => {
    const now = Date.parse("2025-06-01T00:00:00Z");
    const cert = {
      ...base(),
      valid_from: "Jan 1 00:00:00 2020 GMT",
      valid_to: "Jan 1 00:00:00 2030 GMT",
    } as tls.PeerCertificate;
    const r = evaluatePeerCertificate(
      cert,
      false,
      new Error("self signed certificate"),
      now
    );
    expect(r.valid).toBe(false);
    expect(r.error).toBe("self signed certificate");
  });

  it("returns valid when authorized and dates ok", () => {
    const now = Date.parse("2025-06-01T00:00:00Z");
    const cert = {
      ...base(),
      valid_from: "Jan 1 00:00:00 2020 GMT",
      valid_to: "Jan 1 00:00:00 2030 GMT",
    } as tls.PeerCertificate;
    const r = evaluatePeerCertificate(cert, true, null, now);
    expect(r.valid).toBe(true);
    expect(r.error).toBeNull();
  });
});
