import tls from "tls";
import { resolveSafeTlsConnectTarget } from "@/lib/url-allowed";

export type SslCheckResult = {
  valid: boolean;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
  error: string | null;
};

/**
 * Map TLS peer certificate + trust state to a monitor result.
 * Exported for unit tests.
 */
export function evaluatePeerCertificate(
  cert: tls.PeerCertificate,
  authorized: boolean,
  authorizationError: Error | string | null | undefined,
  nowMs: number = Date.now()
): SslCheckResult {
  if (!cert || typeof cert.valid_to !== "string" || !cert.valid_to) {
    return {
      valid: false,
      expiresAt: null,
      daysUntilExpiry: null,
      error: "No peer certificate received",
    };
  }

  const expiresAt = new Date(cert.valid_to);
  if (Number.isNaN(expiresAt.getTime())) {
    return {
      valid: false,
      expiresAt: null,
      daysUntilExpiry: null,
      error: "Invalid certificate expiry date",
    };
  }

  const daysUntilExpiry = Math.ceil(
    (expiresAt.getTime() - nowMs) / (1000 * 60 * 60 * 24)
  );

  const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
  if (
    validFrom &&
    !Number.isNaN(validFrom.getTime()) &&
    nowMs < validFrom.getTime()
  ) {
    return {
      valid: false,
      expiresAt,
      daysUntilExpiry,
      error: "Certificate not yet valid",
    };
  }

  if (nowMs > expiresAt.getTime()) {
    return {
      valid: false,
      expiresAt,
      daysUntilExpiry,
      error: "Certificate expired",
    };
  }

  if (!authorized) {
    const msg =
      authorizationError instanceof Error
        ? authorizationError.message
        : authorizationError != null
          ? String(authorizationError)
          : "Certificate not trusted";
    return {
      valid: false,
      expiresAt,
      daysUntilExpiry,
      error: msg,
    };
  }

  return {
    valid: true,
    expiresAt,
    daysUntilExpiry,
    error: null,
  };
}

/**
 * Check the SSL certificate for an HTTPS URL.
 * Returns null if the URL is not HTTPS.
 * Uses rejectUnauthorized: false so we can inspect invalid/expired certs too.
 */
export async function checkSSL(
  url: string,
  timeoutMs = 10_000
): Promise<SslCheckResult | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  const port = parsed.port ? parseInt(parsed.port, 10) : 443;
  const target = await resolveSafeTlsConnectTarget(parsed.hostname);
  if (!target.ok) {
    return {
      valid: false,
      expiresAt: null,
      daysUntilExpiry: null,
      error: target.error,
    };
  }

  return new Promise((resolve) => {
    let settled = false;

    const settle = (result: SslCheckResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.setTimeout(0);
      } catch {
        // ignore
      }
      try {
        socket.destroy();
      } catch {
        // ignore destroy errors
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      settle({
        valid: false,
        expiresAt: null,
        daysUntilExpiry: null,
        error: "SSL check timed out",
      });
    }, timeoutMs);

    const socket = tls.connect(
      {
        host: target.connectHost,
        port,
        servername: target.servername,
        rejectUnauthorized: false,
        minVersion: "TLSv1.2",
      },
      () => {
        const cert = socket.getPeerCertificate();
        const result = evaluatePeerCertificate(
          cert,
          socket.authorized,
          socket.authorizationError
        );
        settle(result);
      }
    );

    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => {
      settle({
        valid: false,
        expiresAt: null,
        daysUntilExpiry: null,
        error: "SSL check timed out",
      });
    });

    socket.on("error", (err) => {
      settle({
        valid: false,
        expiresAt: null,
        daysUntilExpiry: null,
        error: err.message,
      });
    });
  });
}
