import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { revokeApiKeyById } from "@/lib/api-keys";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const revoked = await revokeApiKeyById(session.user.id, id);
  if (!revoked) {
    return NextResponse.json({ errorCode: "API_KEY_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
