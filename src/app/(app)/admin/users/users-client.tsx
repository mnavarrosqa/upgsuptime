"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { AdminUser } from "./page";

export function AdminUsersClient({
  users: initialUsers,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const adminCount = users.filter((u) => u.role === "admin").length;

  async function toggleRole(u: AdminUser) {
    const newRole = u.role === "admin" ? "user" : "admin";
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update role");
        return;
      }
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, role: newRole } : x))
      );
      toast.success(`Role updated to ${newRole}`);
    } catch {
      toast.error("Failed to update role");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!confirmDelete) return;
    const u = confirmDelete;
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete user");
        return;
      }
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success(`${u.email} deleted`);
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="space-y-3">
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete user"
        message={
          confirmDelete
            ? `Delete ${confirmDelete.email}? This will also delete all their monitors.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={busyId === confirmDelete?.id}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
      <div className="flex justify-end">
        <div className="rounded-full border border-border bg-bg-card px-3 py-1 text-xs font-medium text-text-muted">
          {users.length} total · {adminCount} admin{adminCount !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-page/60 text-left text-xs uppercase tracking-[0.12em] text-text-muted">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Monitors</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              const isBusy = busyId === u.id;
              return (
                <tr
                  key={u.id}
                  className="border-b border-border transition-colors last:border-0 hover:bg-bg-page/50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.email}</div>
                    {isSelf && (
                      <div className="mt-0.5 text-xs text-text-muted">Current session</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {u.username ?? <span className="italic opacity-50">none</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === "admin"
                          ? "bg-accent/10 text-text-primary"
                          : "bg-bg-page text-text-muted"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-text-muted">
                    {u.monitorCount}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(u.createdAt).toLocaleDateString("en-CA")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => toggleRole(u)}
                        disabled={isSelf || isBusy}
                        className="rounded-lg text-text-muted hover:bg-bg-page disabled:cursor-not-allowed disabled:opacity-40"
                        title={isSelf ? "Cannot change your own role" : `Make ${u.role === "admin" ? "user" : "admin"}`}
                      >
                        {isBusy ? "…" : u.role === "admin" ? "Demote" : "Make admin"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setConfirmDelete(u)}
                        disabled={isSelf || isBusy}
                        className="rounded-lg text-red-600 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
                        title={isSelf ? "Cannot delete your own account" : "Delete user"}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <div className="font-medium">No users found</div>
                  <div className="mt-1 text-sm text-text-muted">
                    Registered accounts will appear here.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
