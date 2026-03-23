import { NextResponse } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";

const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_MAX_ATTEMPTS = 5;
// In-memory store: resets on restart and is not shared across instances.
// For multi-instance or production, use a shared store (e.g. Redis or DB) keyed by IP.
const rateStore = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "global";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateStore.get(key);
  if (!entry) return false;
  if (now > entry.resetAt) {
    rateStore.delete(key);
    return false;
  }
  return entry.count >= RATE_MAX_ATTEMPTS;
}

function recordAttempt(key: string): void {
  const now = Date.now();
  const entry = rateStore.get(key);
  if (!entry) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  if (now > entry.resetAt) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export async function POST(request: Request) {
  if (process.env.DISABLE_SETUP === "true") {
    return NextResponse.json({ errorCode: "SETUP_DISABLED" }, { status: 404 });
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return NextResponse.json(
      { errorCode: "RATE_LIMITED_SETUP" },
      { status: 429 }
    );
  }
  recordAttempt(clientKey);

  const [row] = await db.select({ count: count() }).from(user);
  if (row.count > 0) {
    return NextResponse.json(
      { errorCode: "SETUP_COMPLETED" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const usernameRaw = typeof body.username === "string" ? body.username.trim() : "";
  const username = usernameRaw === "" ? null : usernameRaw;
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const language = normalizeLocale(
    typeof body.language === "string" ? body.language : undefined
  );

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { errorCode: "EMAIL_INVALID" },
      { status: 400 }
    );
  }
  if (username !== null) {
    if (!/^[a-zA-Z0-9_]+$/.test(username) || username.length < 2) {
      return NextResponse.json(
        { errorCode: "USERNAME_INVALID" },
        { status: 400 }
      );
    }
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
    if (existing) {
      return NextResponse.json(
        { errorCode: "USERNAME_TAKEN" },
        { status: 400 }
      );
    }
  }
  if (password.length < 8) {
    return NextResponse.json(
      { errorCode: "PASSWORD_TOO_SHORT" },
      { status: 400 }
    );
  }
  if (password !== confirmPassword) {
    return NextResponse.json(
      { errorCode: "PASSWORDS_DO_NOT_MATCH" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = randomUUID();
  const now = new Date();

  await db.insert(user).values({
    id,
    email,
    username,
    passwordHash,
    role: "admin",
    language,
    createdAt: now,
  });

  const response = NextResponse.json({
    success: true,
    userId: id,
    email,
    username: username ?? undefined,
    language,
  });
  response.cookies.set(LOCALE_COOKIE, language, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
