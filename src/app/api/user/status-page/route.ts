import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

const MAX_TITLE = 120;
const MAX_TAGLINE = 400;

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: "INVALID_JSON" }, { status: 400 });
  }

  if (body === null || typeof body !== "object") {
    return NextResponse.json({ errorCode: "INVALID_BODY" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const patch: {
    statusPageTitle?: string | null;
    statusPageTagline?: string | null;
    statusPageShowPoweredBy?: boolean;
  } = {};

  if ("statusPageTitle" in o) {
    const v = o.statusPageTitle;
    if (v === null) {
      patch.statusPageTitle = null;
    } else if (typeof v === "string") {
      const t = v.trim();
      if (t.length > MAX_TITLE) {
        return NextResponse.json(
          { errorCode: "STATUS_PAGE_TITLE_TOO_LONG" },
          { status: 400 }
        );
      }
      patch.statusPageTitle = t || null;
    } else {
      return NextResponse.json({ errorCode: "INVALID_BODY" }, { status: 400 });
    }
  }

  if ("statusPageTagline" in o) {
    const v = o.statusPageTagline;
    if (v === null) {
      patch.statusPageTagline = null;
    } else if (typeof v === "string") {
      const t = v.trim();
      if (t.length > MAX_TAGLINE) {
        return NextResponse.json(
          { errorCode: "STATUS_PAGE_TAGLINE_TOO_LONG" },
          { status: 400 }
        );
      }
      patch.statusPageTagline = t || null;
    } else {
      return NextResponse.json({ errorCode: "INVALID_BODY" }, { status: 400 });
    }
  }

  if ("statusPageShowPoweredBy" in o) {
    if (typeof o.statusPageShowPoweredBy !== "boolean") {
      return NextResponse.json({ errorCode: "INVALID_BODY" }, { status: 400 });
    }
    patch.statusPageShowPoweredBy = o.statusPageShowPoweredBy;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ errorCode: "NO_FIELDS" }, { status: 400 });
  }

  await db.update(user).set(patch).where(eq(user.id, session.user.id));

  return NextResponse.json({ success: true, ...patch });
}
