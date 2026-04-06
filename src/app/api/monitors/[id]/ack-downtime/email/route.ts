import { NextResponse } from "next/server";
import { db } from "@/db";
import { monitor } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyEmailAckToken } from "@/lib/email-ack-token";
import { getAppBaseUrlForEmail } from "@/lib/notify";

/**
 * One-click downtime acknowledgment from email (HMAC token, no login).
 * GET /api/monitors/[id]/ack-downtime/email?t=...
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const t = new URL(request.url).searchParams.get("t");
  const origin =
    getAppBaseUrlForEmail() || new URL(request.url).origin;

  const redirectWith = (query: Record<string, string>) => {
    const qs = new URLSearchParams(query);
    return NextResponse.redirect(
      `${origin}/monitors/${id}?${qs.toString()}`,
      302
    );
  };

  if (!t) {
    return redirectWith({ ack: "invalid" });
  }

  const parsed = verifyEmailAckToken(t);
  if (!parsed || parsed.monitorId !== id) {
    return redirectWith({ ack: "invalid" });
  }

  const [m] = await db.select().from(monitor).where(eq(monitor.id, id));
  if (!m) {
    return redirectWith({ ack: "invalid" });
  }

  if (
    m.currentStatus !== false ||
    !m.lastStatusChangedAt ||
    m.lastStatusChangedAt.getTime() !== parsed.episodeMs
  ) {
    return redirectWith({ ack: "expired" });
  }

  await db
    .update(monitor)
    .set({ downtimeAckEpisodeAt: m.lastStatusChangedAt })
    .where(eq(monitor.id, id));

  return redirectWith({ ack: "email" });
}
