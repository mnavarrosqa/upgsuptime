import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [{ url: "/~offline", revision: "1" }],
  reloadOnOnline: false,
});
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

function getAllowedDevOrigins(): string[] {
  const configured = process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

  return Array.from(new Set([...configured, "localhost:3077"]));
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  webpack(config, { isServer }) {
    if (isServer) {
      config.externalsPresets = { ...config.externalsPresets, node: true };
    }
    return config;
  },
  // Allow dev server to be opened by configured hostnames/IPs instead of only localhost.
  ...(process.env.NODE_ENV !== "production"
    ? { allowedDevOrigins: getAllowedDevOrigins() }
    : {}),
  // So NextAuth accepts login when the app is opened by IP
  env: process.env.NODE_ENV !== "production" ? { AUTH_TRUST_HOST: "true" } : {},
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    // Content-Security-Policy is set per-request in src/proxy.ts (middleware) so it
    // can carry a per-request nonce for script-src. The static headers below apply
    // to every route, including static assets.
    const securityHeaders: { key: string; value: string }[] = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];
    if (!isDev) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default withNextIntl(withSerwist(nextConfig));
