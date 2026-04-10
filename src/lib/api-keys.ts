import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { apiKey } from "@/db/schema";

export const API_KEY_SCOPE_STATUS_READ = "status:read" as const;
export type ApiKeyScope = typeof API_KEY_SCOPE_STATUS_READ;

const TOKEN_PREFIX = "upg_live_";
const TOKEN_SECRET_BYTES = 24;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

type ApiKeyRow = typeof apiKey.$inferSelect;

export function maskApiToken(token: string): string {
  if (token.length <= 10) return "****";
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function verifyHash(expectedHex: string, value: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = sha256(value);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function parseCorsOriginsInput(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (!["http:", "https:"].includes(url.protocol)) continue;
      const normalized = url.origin.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      valid.push(normalized);
    } catch {
      continue;
    }
  }
  return valid.slice(0, 20);
}

export function parseCorsOriginsStored(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return parseCorsOriginsInput(parsed);
  } catch {
    return [];
  }
}

export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  try {
    const normalized = new URL(origin).origin.toLowerCase();
    return allowedOrigins.includes(normalized);
  } catch {
    return false;
  }
}

export function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

export function createApiKeyToken() {
  const id = randomUUID();
  const secret = randomBytes(TOKEN_SECRET_BYTES).toString("hex");
  const keyPrefix = `${TOKEN_PREFIX}${secret.slice(0, 12)}`;
  const token = `${keyPrefix}.${secret}`;
  return {
    id,
    token,
    keyPrefix,
    keyHash: sha256(token).toString("hex"),
  };
}

export function parseBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

export function parseTokenPrefix(token: string): string | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0) return null;
  const prefix = token.slice(0, dotIndex);
  if (!prefix.startsWith(TOKEN_PREFIX)) return null;
  return prefix;
}

export type AuthResult =
  | { ok: true; key: ApiKeyRow; corsOrigins: string[]; token: string }
  | { ok: false; status: 401 | 403; errorCode: string };

export async function authenticateApiKey(
  request: Request,
  requiredScope: ApiKeyScope
): Promise<AuthResult> {
  const token = parseBearerToken(request);
  if (!token) return { ok: false, status: 401, errorCode: "API_KEY_MISSING" };

  const keyPrefix = parseTokenPrefix(token);
  if (!keyPrefix) return { ok: false, status: 401, errorCode: "API_KEY_INVALID" };

  const [row] = await db
    .select()
    .from(apiKey)
    .where(and(eq(apiKey.keyPrefix, keyPrefix), isNull(apiKey.revokedAt)));

  if (!row || !verifyHash(row.keyHash, token)) {
    return { ok: false, status: 401, errorCode: "API_KEY_INVALID" };
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
    return { ok: false, status: 401, errorCode: "API_KEY_EXPIRED" };
  }

  if (row.scope !== requiredScope) {
    return { ok: false, status: 403, errorCode: "API_KEY_SCOPE_INVALID" };
  }

  return {
    ok: true,
    key: row,
    corsOrigins: parseCorsOriginsStored(row.corsOrigins),
    token,
  };
}

export function enforceApiRateLimit(keyId: string):
  | { ok: true }
  | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(keyId);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(keyId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  rateLimitBuckets.set(keyId, bucket);
  return { ok: true };
}

export async function touchApiKeyUsage(keyId: string, ip: string | null) {
  await db
    .update(apiKey)
    .set({
      lastUsedAt: new Date(),
      lastUsedIp: ip ?? null,
    })
    .where(eq(apiKey.id, keyId));
}

/** True if another non-revoked key for this user already uses this exact name. */
export async function isApiKeyNameTaken(
  userId: string,
  name: string,
  excludeKeyId?: string
): Promise<boolean> {
  const conditions = [eq(apiKey.userId, userId), isNull(apiKey.revokedAt), eq(apiKey.name, name)];
  if (excludeKeyId) {
    conditions.push(ne(apiKey.id, excludeKeyId));
  }
  const [row] = await db
    .select({ id: apiKey.id })
    .from(apiKey)
    .where(and(...conditions))
    .limit(1);
  return !!row;
}

export async function revokeApiKeyById(userId: string, keyId: string): Promise<boolean> {
  const now = new Date();
  const result = await db
    .update(apiKey)
    .set({ revokedAt: now })
    .where(
      and(eq(apiKey.id, keyId), eq(apiKey.userId, userId), isNull(apiKey.revokedAt))
    );
  return result.changes > 0;
}
