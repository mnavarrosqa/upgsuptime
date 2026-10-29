import { apiError, apiJson, getApiUser } from "@/lib/api-v1";
import { loadActivityFeed } from "@/lib/activity-feed";

/** Recent status changes and slow-response alerts (last 7 days), newest first. */
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED");
  return apiJson({ items: await loadActivityFeed(user.id) });
}
