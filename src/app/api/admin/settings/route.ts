import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

const SMTP_VARS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "registrationEnabled"));

  const registrationEnabled = row ? row.value !== "false" : true;
  const smtpConfigured = !!process.env.SMTP_HOST;
  const smtpVarsSet = SMTP_VARS.reduce<Record<string, boolean>>((acc, v) => {
    acc[v] = !!process.env[v];
    return acc;
  }, {});

  return NextResponse.json({ registrationEnabled, smtpConfigured, smtpVarsSet });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (typeof body.registrationEnabled === "boolean") {
    await db
      .insert(settings)
      .values({ key: "registrationEnabled", value: String(body.registrationEnabled) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: String(body.registrationEnabled) },
      });
  }

  return NextResponse.json({ success: true });
}
