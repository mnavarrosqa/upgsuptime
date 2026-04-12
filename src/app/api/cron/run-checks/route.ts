import { NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/cron-secret";
import { runDueChecks } from "@/lib/scheduler";

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
