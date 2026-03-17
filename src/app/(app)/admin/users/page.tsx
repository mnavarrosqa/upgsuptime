import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminUsersClient } from "./users-client";

export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  role: "admin" | "user";
  createdAt: string;
  monitorCount: number;
}

async function getUsers(): Promise<AdminUser[]> {
  const res = await fetch(
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/admin/users`,
    { cache: "no-store" }
  );
  return res.json();
}

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const users = await getUsers();

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
