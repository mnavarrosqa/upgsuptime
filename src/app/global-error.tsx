"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      const theme = localStorage.getItem("theme");
      const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = theme === "dark" || (theme !== "light" && preferDark);
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      // localStorage unavailable (private mode, etc.)
    }
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong — UPG Monitor</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --bg-page: #faf9f7;
            --bg-card: #ffffff;
            --text-primary: #1c1917;
            --text-muted: #78716c;
            --border: #e7e5e4;
            --accent: #1c1917;
          }
          .dark {
            --bg-page: #0c0a09;
            --bg-card: #1c1917;
            --text-primary: #fafaf9;
            --text-muted: #a8a29e;
            --border: #292524;
            --accent: #fafaf9;
          }
          body {
            background: var(--bg-page);
            color: var(--text-primary);
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            -webkit-font-smoothing: antialiased;
          }
          button { font-family: inherit; }
          @keyframes ping {
            75%, 100% { transform: scale(2); opacity: 0; }
          }
        `}</style>
      </head>
      <body>
        <div style={{
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1rem",
        }}>
          <div style={{ width: "100%", maxWidth: "24rem", textAlign: "center" }}>
            {/* Brand */}
            <div style={{
              marginBottom: "2rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
            }}>
              <div style={{
                height: "3.5rem",
                width: "3.5rem",
                borderRadius: "1rem",
                background: "var(--accent)",
                color: "var(--bg-page)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <p style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}>
                UPG Monitor
              </p>
            </div>

            <h1 style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              letterSpacing: "-0.025em",
              marginBottom: "0.75rem",
              color: "var(--text-primary)",
            }}>
              Something went wrong
            </h1>
            <p style={{
              fontSize: "0.875rem",
              lineHeight: "1.6",
              color: "var(--text-muted)",
              marginBottom: "2rem",
            }}>
              An unexpected error occurred. You can try reloading or return to the dashboard.
            </p>

            {/* Card */}
            <div style={{
              borderRadius: "1rem",
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              padding: "1.5rem",
              marginBottom: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}>
              {process.env.NODE_ENV !== "production" && error?.message && (
                <p style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  wordBreak: "break-word",
                  textAlign: "left",
                  padding: "0.75rem",
                  background: "var(--bg-page)",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                }}>
                  {error.message}
                </p>
              )}
              <button
                onClick={reset}
                style={{
                  width: "100%",
                  borderRadius: "0.5rem",
                  background: "var(--accent)",
                  color: "var(--bg-page)",
                  border: "none",
                  padding: "0.625rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <a
                href="/dashboard"
                style={{
                  display: "block",
                  textAlign: "center",
                  fontSize: "0.875rem",
                  color: "var(--text-muted)",
                  textDecoration: "none",
                }}
              >
                Go to dashboard
              </a>
            </div>

            {error?.digest && (
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
