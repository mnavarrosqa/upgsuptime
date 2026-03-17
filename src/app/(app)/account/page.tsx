import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Mail, Shield, User } from "lucide-react";
import { ProfileForm } from "@/components/profile-form";
import { PasswordForm } from "@/components/password-form";

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { email, name, role } = session.user;
  const initials = getInitials(name, email ?? "");

  return (
    <div className="mx-auto max-w-xl">
      <h1
        className="text-2xl font-semibold tracking-tight text-text-primary"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Account
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Manage your account details and security settings.
      </p>

      {/* Identity card */}
      <div className="mt-8 flex items-center gap-4 rounded-lg border border-border bg-bg-card px-6 py-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-bg-card">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">
            {name ?? email}
          </p>
          {name && (
            <p className="truncate text-sm text-text-muted">{email}</p>
          )}
          <span
            className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              role === "admin"
                ? "bg-accent text-bg-card"
                : "border border-border text-text-muted"
            }`}
          >
            <Shield className="h-3 w-3" aria-hidden />
            {role ?? "user"}
          </span>
        </div>
      </div>

      {/* Field details */}
      <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-bg-card">
        <div className="flex items-center gap-3 px-6 py-4">
          <User className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Username
            </p>
            <p className="mt-0.5 text-sm text-text-primary">
              {name ?? <span className="italic text-text-muted">Not set</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-6 py-4">
          <Mail className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Email
            </p>
            <p className="mt-0.5 truncate text-sm text-text-primary">
              {email ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-6 py-4">
          <Shield className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Role
            </p>
            <p className="mt-0.5 capitalize text-sm text-text-primary">
              {role ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Profile section */}
      <div className="mt-10">
        <h2
          className="text-base font-semibold text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Profile
        </h2>
        <p className="mt-0.5 text-sm text-text-muted">
          Update your username. Email cannot be changed.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-bg-card px-6 py-5">
          <ProfileForm username={name} />
        </div>
      </div>

      {/* Security section */}
      <div className="mt-10">
        <h2
          className="text-base font-semibold text-text-primary"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Security
        </h2>
        <p className="mt-0.5 text-sm text-text-muted">
          Change your password. You&apos;ll stay signed in after changing it.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-bg-card px-6 py-5">
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
