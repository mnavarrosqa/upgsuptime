"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="h-auto px-0 text-sm text-text-muted hover:bg-transparent hover:text-text-primary"
    >
      Sign out
    </Button>
  );
}
