const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_MAX_ATTEMPTS = 10;

const store = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export function isLoginRateLimited(request: Request): boolean {
  const key = getClientKey(request);
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) return false;
  if (now > entry.resetAt) {
    store.delete(key);
    return false;
  }
  return entry.count >= RATE_MAX_ATTEMPTS;
}

export function recordLoginAttempt(request: Request): void {
  const key = getClientKey(request);
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  if (now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  entry.count += 1;
}
