import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/**
 * For admin pages. The admin layout also checks, but layouts render in parallel
 * with their pages, so each page must not touch admin data on its own without
 * this guard (a stale or foreign session cookie otherwise reaches the page).
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");
  return session;
}
