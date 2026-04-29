import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { user, monitor } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { AdminUsersClient } from "./users-client";
import { AdminSubNav } from "@/components/admin-sub-nav";

export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  role: "admin" | "user";
  createdAt: string;
  monitorCount: number;
}

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);

  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      monitorCount: count(monitor.id),
    })
    .from(user)
    .leftJoin(monitor, eq(monitor.userId, user.id))
    .groupBy(user.id)
    .orderBy(user.createdAt);

  const users: AdminUser[] = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          Access control
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
            <p className="mt-1 max-w-2xl text-sm text-text-muted">
              Review accounts, ownership load, and elevated permissions.
            </p>
          </div>
        </div>
      </div>
      <AdminSubNav />
      <AdminUsersClient users={users} currentUserId={session!.user.id} />
    </div>
  );
}
