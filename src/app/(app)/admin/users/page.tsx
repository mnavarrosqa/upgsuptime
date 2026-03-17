import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user, monitor } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { AdminUsersClient } from "./users-client";

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
  if (!session?.user) redirect("/login");

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage user accounts and roles
        </p>
      </div>
      <AdminUsersClient users={users} currentUserId={session.user.id} />
    </div>
  );
}
