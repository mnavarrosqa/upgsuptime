import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteWebPushSubscription,
  getWebPushPublicKey,
  parseBrowserSubscription,
  saveWebPushSubscription,
} from "@/lib/web-push";

/** Whether browser notifications are available, and the VAPID key to subscribe with. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }
  const publicKey = getWebPushPublicKey();
  return NextResponse.json({ enabled: publicKey !== null, publicKey });
}

/** Saves this browser's push subscription: `{ subscription: PushSubscriptionJSON }`. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!getWebPushPublicKey()) {
    return NextResponse.json({ errorCode: "WEB_PUSH_DISABLED" }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { subscription?: unknown } | null;
  const subscription = parseBrowserSubscription(body?.subscription);
  if (!subscription) {
    return NextResponse.json({ errorCode: "INVALID_SUBSCRIPTION" }, { status: 400 });
  }
  await saveWebPushSubscription(session.user.id, subscription, request.headers.get("user-agent"));
  return NextResponse.json({ success: true });
}

/** Removes this browser's subscription: `{ endpoint }`. */
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") {
    return NextResponse.json({ errorCode: "INVALID_SUBSCRIPTION" }, { status: 400 });
  }
  await deleteWebPushSubscription(session.user.id, body.endpoint);
  return NextResponse.json({ success: true });
}
