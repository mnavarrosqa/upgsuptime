import { getApiUser, apiError } from "@/lib/api-v1";
import { revokeMobileSession } from "@/lib/mobile-auth";
import { NextResponse } from "next/server";

/** Signs this device out: revokes its session and the push devices registered with it. */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user?.sessionId) return apiError(401, "UNAUTHORIZED");
  await revokeMobileSession(user.sessionId);
  return new NextResponse(null, { status: 204 });
}
