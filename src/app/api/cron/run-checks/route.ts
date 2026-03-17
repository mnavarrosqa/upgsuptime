import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runDueChecks } from "@/lib/scheduler";

function validateCronSecret(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (typeof expected !== "string" || expected.length === 0) {
    return false;
  }
  if (provided === null || provided === "") {
    return false;
  }
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");

  if (!validateCronSecret(secret)) {
    if (typeof process.env.CRON_SECRET !== "string" || process.env.CRON_SECRET.length === 0) {
      return NextResponse.json(
        { error: "Cron endpoint not configured" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ran } = await runDueChecks();
  return NextResponse.json({ ran });
}
