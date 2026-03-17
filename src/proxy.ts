import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/login-rate-limit";

const authMiddleware = withAuth({
  pages: { signIn: "/login" },
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/auth") && request.method === "POST") {
    if (isLoginRateLimited(request)) {
      return NextResponse.redirect(
        new URL("/login?error=rate_limit", request.url),
        303
      );
    }
    recordLoginAttempt(request);
  }

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/monitors") ||
    pathname.startsWith("/api/monitors")
  ) {
    return authMiddleware(request as Parameters<typeof authMiddleware>[0], event);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/monitors/:path*",
    "/api/monitors/:path*",
    "/api/auth/:path*",
  ],
};

