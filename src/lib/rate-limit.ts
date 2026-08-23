/**
 * In-memory rate limiter.
 * For production, replace with Redis-based rate limiting (Upstash, etc.).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Check if a request is rate-limited.
 * @param key - Unique identifier (e.g., IP + endpoint)
 * @param limit - Max requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count++;

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Rate limit configs for different endpoints.
 */
export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 15 * 60 * 1000 },       // 5 per 15 min
  register: { limit: 3, windowMs: 60 * 60 * 1000 },     // 3 per hour
  search: { limit: 30, windowMs: 60 * 1000 },            // 30 per minute
  api: { limit: 100, windowMs: 60 * 1000 },              // 100 per minute
  connectionRequest: { limit: 20, windowMs: 24 * 3600 * 1000 }, // 20 per day
  message: { limit: 50, windowMs: 24 * 3600 * 1000 },    // 50 per day
} as const;
