import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { mobileSession, pushDevice, user as userTable } from "@/db/schema";
import { normalizeLocale } from "@/i18n/config";
import type { AuthenticatedUser } from "@/lib/credentials";

/** Short-lived bearer token for API calls. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** Refresh tokens slide: each refresh extends the session by this much. */
const REFRESH_TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60;

const REFRESH_TOKEN_PREFIX = "upg_rt_";
const ACCESS_TOKEN_TYPE = "access";

type AccessTokenClaims = { sub: string; sid: string; typ: string; iat: number; exp: number };

export type MobileTokens = {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  sessionId: string;
};

export type MobileRequestUser = AuthenticatedUser & { sessionId: string };

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signingKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to issue app tokens");
  // Separate key from next-auth's own use of the secret.
  return createHmac("sha256", secret).update("upg-mobile-access-token").digest();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Signs an HS256 JWT access token bound to a mobile session. */
export function signAccessToken(userId: string, sessionId: string, now = new Date()): { token: string; expiresAt: Date } {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + ACCESS_TOKEN_TTL_SECONDS;
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const claims: AccessTokenClaims = { sub: userId, sid: sessionId, typ: ACCESS_TOKEN_TYPE, iat, exp };
  const payload = base64url(JSON.stringify(claims));
  const signature = createHmac("sha256", signingKey()).update(`${header}.${payload}`).digest("base64url");
  return { token: `${header}.${payload}.${signature}`, expiresAt: new Date(exp * 1000) };
}

/** Verifies signature, type and expiry. Does not check whether the session was revoked. */
export function verifyAccessToken(token: string, now = new Date()): { userId: string; sessionId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = createHmac("sha256", signingKey()).update(`${header}.${payload}`).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  let claims: Partial<AccessTokenClaims>;
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as { alg?: string };
    if (parsedHeader.alg !== "HS256") return null;
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AccessTokenClaims>;
  } catch {
    return null;
  }
  if (claims.typ !== ACCESS_TOKEN_TYPE || typeof claims.sub !== "string" || typeof claims.sid !== "string") {
    return null;
  }
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now.getTime()) return null;
  return { userId: claims.sub, sessionId: claims.sid };
}

function newRefreshToken(): string {
  return `${REFRESH_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

function refreshExpiry(now: Date): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

/** Signs a user in on a device: creates a session and returns its first token pair. */
export async function createMobileSession(
  userId: string,
  deviceName: string | null,
  now = new Date(),
): Promise<MobileTokens> {
  const sessionId = randomUUID();
  const refreshToken = newRefreshToken();
  const refreshTokenExpiresAt = refreshExpiry(now);
  await db.insert(mobileSession).values({
    id: sessionId,
    userId,
    deviceName: deviceName?.trim().slice(0, 100) || null,
    refreshTokenHash: hashToken(refreshToken),
    createdAt: now,
    lastUsedAt: now,
    expiresAt: refreshTokenExpiresAt,
  });
  const access = signAccessToken(userId, sessionId, now);
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken,
    refreshTokenExpiresAt,
    sessionId,
  };
}

export type RefreshResult =
  | { ok: true; tokens: MobileTokens }
  | { ok: false; reason: "invalid" | "expired" | "reused" };

/**
 * Exchanges a refresh token for a new pair and rotates it. Presenting the token
 * that was just replaced means it was copied, so the whole session is revoked.
 */
export async function refreshMobileSession(refreshToken: string, now = new Date()): Promise<RefreshResult> {
  if (!refreshToken.startsWith(REFRESH_TOKEN_PREFIX)) return { ok: false, reason: "invalid" };
  const hash = hashToken(refreshToken);

  const [current] = await db
    .select({
      id: mobileSession.id,
      userId: mobileSession.userId,
      expiresAt: mobileSession.expiresAt,
      revokedAt: mobileSession.revokedAt,
    })
    .from(mobileSession)
    // Inner join: sessions of deleted accounts cannot be refreshed.
    .innerJoin(userTable, eq(userTable.id, mobileSession.userId))
    .where(eq(mobileSession.refreshTokenHash, hash));
  if (!current) {
    const [replaced] = await db
      .select({ id: mobileSession.id })
      .from(mobileSession)
      .where(and(eq(mobileSession.previousRefreshTokenHash, hash), isNull(mobileSession.revokedAt)));
    if (replaced) {
      await revokeMobileSession(replaced.id, now);
      return { ok: false, reason: "reused" };
    }
    return { ok: false, reason: "invalid" };
  }
  if (current.revokedAt) return { ok: false, reason: "invalid" };
  if (current.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  const nextRefreshToken = newRefreshToken();
  const refreshTokenExpiresAt = refreshExpiry(now);
  await db
    .update(mobileSession)
    .set({
      refreshTokenHash: hashToken(nextRefreshToken),
      previousRefreshTokenHash: hash,
      lastUsedAt: now,
      expiresAt: refreshTokenExpiresAt,
    })
    .where(eq(mobileSession.id, current.id));

  const access = signAccessToken(current.userId, current.id, now);
  return {
    ok: true,
    tokens: {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt,
      sessionId: current.id,
    },
  };
}

/** Signs a device out. Its push registrations go with it so it stops getting alerts. */
export async function revokeMobileSession(sessionId: string, now = new Date()): Promise<void> {
  await db
    .update(mobileSession)
    .set({ revokedAt: now })
    .where(and(eq(mobileSession.id, sessionId), isNull(mobileSession.revokedAt)));
  await db.delete(pushDevice).where(eq(pushDevice.sessionId, sessionId));
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/** True when the request carries an `Authorization: Bearer` header (valid or not). */
export function hasBearerToken(request: Request): boolean {
  return bearerToken(request) !== null;
}

/**
 * Resolves the user behind an app access token. The session row is checked on
 * every request so sign-out and password changes take effect immediately.
 */
export async function authenticateMobileRequest(request: Request, now = new Date()): Promise<MobileRequestUser | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const claims = verifyAccessToken(token, now);
  if (!claims) return null;

  const [row] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      username: userTable.username,
      role: userTable.role,
      language: userTable.language,
    })
    .from(mobileSession)
    .innerJoin(userTable, eq(userTable.id, mobileSession.userId))
    .where(
      and(
        eq(mobileSession.id, claims.sessionId),
        eq(mobileSession.userId, claims.userId),
        isNull(mobileSession.revokedAt),
        gt(mobileSession.expiresAt, now),
      ),
    );
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username ?? null,
    role: row.role,
    language: normalizeLocale(row.language),
    sessionId: claims.sessionId,
  };
}

/** Signs every device out, e.g. after a password change. */
export async function revokeAllMobileSessions(userId: string, now = new Date()): Promise<void> {
  await db
    .update(mobileSession)
    .set({ revokedAt: now })
    .where(and(eq(mobileSession.userId, userId), isNull(mobileSession.revokedAt)));
  await db.delete(pushDevice).where(eq(pushDevice.userId, userId));
}
