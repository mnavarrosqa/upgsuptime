import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { normalizeLocale } from "@/i18n/config";
import { sendWebPushToUser } from "@/lib/web-push";

/** Sends a test notification to this browser only: `{ endpoint }`. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") {
    return NextResponse.json({ errorCode: "INVALID_SUBSCRIPTION" }, { status: 400 });
  }

  const t = await getTranslations({
    locale: normalizeLocale((session.user as { language?: string }).language),
    namespace: "notifications",
  });
  const outcome = await sendWebPushToUser(
    session.user.id,
    { title: t("testTitle"), body: t("testBody"), url: "/account#notifications", tag: "test" },
    body.endpoint,
  );
  if (outcome.sent === 0) {
    return NextResponse.json({ errorCode: "WEB_PUSH_SEND_FAILED" }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
