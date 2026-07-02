import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/login-rate-limit";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/monitors",
  "/api/monitors",
  "/api/admin",
];

const isDev = process.env.NODE_ENV !== "production";

/** Cryptographically random, base64-encoded per-request nonce. */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Content-Security-Policy for the response.
 * - Production: script-src is locked to a per-request nonce + 'strict-dynamic'
 *   (no 'unsafe-inline'), so injected inline scripts cannot execute.
 * - Development: keep 'unsafe-inline'/'unsafe-eval' so HMR keeps working.
 * style-src keeps 'unsafe-inline' because Tailwind/Recharts inject inline styles.
 */
function buildCsp(nonce: string | null): string {
  const scriptSrc =
    nonce === null
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // One nonce per request. Forwarded to the render via request headers so Next.js
  // tags its own inline/bootstrap scripts with it (and we tag the theme script).
  const nonce = isDev ? null : generateNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  if (nonce) {
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);
  }
  const withCsp = <T extends NextResponse>(response: T): T => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  if (
    process.env.MAINTENANCE_MODE === "true" &&
    !pathname.startsWith("/maintenance")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    return withCsp(
      NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    );
  }

  // Only throttle the credentials sign-in itself, not every /api/auth POST
  // (e.g. sign-out, CSRF), which would otherwise consume the login budget.
  if (
    pathname === "/api/auth/callback/credentials" &&
    request.method === "POST"
  ) {
    if (isLoginRateLimited(request)) {
      return withCsp(
        NextResponse.redirect(
          new URL("/login?error=rate_limit", request.url),
          303
        )
      );
    }
    recordLoginAttempt(request);
  }

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
      return withCsp(NextResponse.redirect(loginUrl));
    }
  }

  return withCsp(
    NextResponse.next({ request: { headers: requestHeaders } })
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
