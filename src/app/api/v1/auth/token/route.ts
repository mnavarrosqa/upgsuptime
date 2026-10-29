import { verifyCredentials } from "@/lib/credentials";
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/login-rate-limit";
import { createMobileSession } from "@/lib/mobile-auth";
import { apiError, apiJson, tokenResponse } from "@/lib/api-v1";

/** Signs in from the native app: `{ login, password, deviceName? }` → token pair. */
export async function POST(request: Request) {
  if (isLoginRateLimited(request)) {
    return apiError(429, "RATE_LIMITED", "Too many sign-in attempts. Try again later.");
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, "INVALID_JSON");
  }
  const login = typeof body.login === "string" ? body.login : "";
  const password = typeof body.password === "string" ? body.password : "";
  const deviceName = typeof body.deviceName === "string" ? body.deviceName : null;
  if (!login.trim() || !password) {
    return apiError(400, "CREDENTIALS_REQUIRED", "login and password are required");
  }

  recordLoginAttempt(request);
  const user = await verifyCredentials(login, password);
  if (!user) return apiError(401, "INVALID_CREDENTIALS");

  const tokens = await createMobileSession(user.id, deviceName);
  return apiJson({
    ...tokenResponse(tokens),
    user: { id: user.id, email: user.email, username: user.username, role: user.role, language: user.language },
  });
}
