import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ errorCode: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json();
  const usernameRaw =
    typeof body.username === "string" ? body.username.trim() : null;
  const username = usernameRaw === "" ? null : usernameRaw;
  const language = normalizeLocale(
    typeof body.language === "string" ? body.language : session.user.language
  );

  if (username !== null) {
    if (username.length < 2 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { errorCode: "USERNAME_INVALID" },
        { status: 400 }
      );
    }
    const [taken] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.username, username), ne(user.id, session.user.id)));
    if (taken) {
      return NextResponse.json(
        { errorCode: "USERNAME_TAKEN" },
        { status: 400 }
      );
    }
  }

  await db
    .update(user)
    .set({ username, language })
    .where(eq(user.id, session.user.id));

  const response = NextResponse.json({ success: true, username, language });
  response.cookies.set(LOCALE_COOKIE, language, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
