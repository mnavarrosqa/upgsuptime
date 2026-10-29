import { refreshMobileSession } from "@/lib/mobile-auth";
import { apiError, apiJson, tokenResponse } from "@/lib/api-v1";

/** Rotates a refresh token: `{ refreshToken }` → new token pair. The old refresh token stops working. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, "INVALID_JSON");
  }
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  if (!refreshToken) return apiError(400, "REFRESH_TOKEN_REQUIRED");

  const result = await refreshMobileSession(refreshToken);
  if (!result.ok) {
    const code = result.reason === "expired" ? "REFRESH_TOKEN_EXPIRED" : "REFRESH_TOKEN_INVALID";
    return apiError(401, code);
  }
  return apiJson(tokenResponse(result.tokens));
}
