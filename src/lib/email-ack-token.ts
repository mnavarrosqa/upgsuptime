import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_VERSION = 1;
/** Signed links remain valid for 30 days (email may be read late). */
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret(): string {
  const s =
    process.env.EMAIL_ACK_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  return s;
}

export function canSignEmailAckTokens(): boolean {
  return getSecret().length > 0;
}

/**
 * Signed token for one-click downtime ack from email (no session).
 * Payload: monitor id + episode ms (must match lastStatusChangedAt when applied).
 */
export function signEmailAckToken(monitorId: string, episodeMs: number): string {
  const exp = Date.now() + TOKEN_MAX_AGE_MS;
  const payload = JSON.stringify({
    v: TOKEN_VERSION,
    m: monitorId,
    e: episodeMs,
    x: exp,
  });
  const sig = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyEmailAckToken(
  token: string
): { monitorId: string; episodeMs: number } | null {
  if (!token || !canSignEmailAckTokens()) return null;
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expectedSig = createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
  let sigBuf: Buffer;
  let expBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, "base64url");
    expBuf = Buffer.from(expectedSig, "base64url");
  } catch {
    return null;
  }
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  let p: { v?: number; m?: string; e?: number; x?: number };
  try {
    p = JSON.parse(payload) as { v?: number; m?: string; e?: number; x?: number };
  } catch {
    return null;
  }
  if (
    p.v !== TOKEN_VERSION ||
    typeof p.m !== "string" ||
    typeof p.e !== "number" ||
    typeof p.x !== "number"
  ) {
    return null;
  }
  if (Date.now() > p.x) return null;
  return { monitorId: p.m, episodeMs: p.e };
}
