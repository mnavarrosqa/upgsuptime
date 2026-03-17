import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const usernameRaw =
    typeof body.username === "string" ? body.username.trim() : null;
  const username = usernameRaw === "" ? null : usernameRaw;

  if (username !== null) {
    if (username.length < 2 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username must be at least 2 characters and only contain letters, numbers, and underscores",
        },
        { status: 400 }
      );
    }
    const [taken] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.username, username), ne(user.id, session.user.id)));
    if (taken) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 400 }
      );
    }
  }

  await db
    .update(user)
    .set({ username })
    .where(eq(user.id, session.user.id));

  return NextResponse.json({ success: true, username });
}
