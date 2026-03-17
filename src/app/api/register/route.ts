import { NextResponse } from "next/server";
import { db } from "@/db";
import { user, settings } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_MAX_ATTEMPTS = 5;
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
  const [row] = await db.select({ count: count() }).from(user);
  if (row.count === 0) {
    return NextResponse.json(
      { error: "Create the admin account first via the setup page." },
      { status: 403 }
    );
  }

  const [regSetting] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "registrationEnabled"));
  if (regSetting && regSetting.value === "false") {
    return NextResponse.json(
      { error: "Registration is currently disabled." },
      { status: 403 }
    );
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429 }
    );
  }
  recordAttempt(clientKey);

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const usernameRaw = typeof body.username === "string" ? body.username.trim() : "";
  const username = usernameRaw === "" ? null : usernameRaw;
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    );
  }
  const [existingEmail] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existingEmail) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 400 }
    );
  }
  if (username !== null) {
    if (!/^[a-zA-Z0-9_]+$/.test(username) || username.length < 2) {
      return NextResponse.json(
        { error: "Username must be at least 2 characters and only letters, numbers, and underscores" },
        { status: 400 }
      );
    }
    const [existingUsername] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
    if (existingUsername) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 400 }
      );
    }
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (password !== confirmPassword) {
    return NextResponse.json(
      { error: "Passwords do not match" },
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
    role: "user",
    createdAt: now,
  });

  return NextResponse.json({
    success: true,
    userId: id,
    email,
    username: username ?? undefined,
  });
}
