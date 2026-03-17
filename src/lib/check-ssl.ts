import tls from "tls";

export type SslCheckResult = {
  valid: boolean;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
  error: string | null;
};

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

  const hostname = parsed.hostname;
  const port = parsed.port ? parseInt(parsed.port, 10) : 443;

  return new Promise((resolve) => {
    let settled = false;

    const settle = (result: SslCheckResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
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
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;

        let expiresAt: Date | null = null;
        if (cert?.valid_to) {
          expiresAt = new Date(cert.valid_to);
        }

        const daysUntilExpiry =
          expiresAt != null
            ? Math.ceil(
                (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              )
            : null;

        const error = authorized
          ? null
          : socket.authorizationError?.toString() ?? "Certificate not trusted";

        settle({ valid: authorized, expiresAt, daysUntilExpiry, error });
      }
    );

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
