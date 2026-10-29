import { getApiUser, apiError, apiJson } from "@/lib/api-v1";

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED");
  return apiJson({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    language: user.language,
  });
}
