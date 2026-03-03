/**
 * Simple in-memory rate limiter for auth endpoints.
 * Uses sliding window counter per IP.
 */

const store = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10; // 10 attempts per window

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
        store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterMs: 0 };
    }

    if (entry.count >= MAX_ATTEMPTS) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterMs: entry.resetAt - now,
        };
    }

    entry.count++;
    return { allowed: true, remaining: MAX_ATTEMPTS - entry.count, retryAfterMs: 0 };
}

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
    setInterval(() => {
        const now = Date.now();
        for (const [key, val] of store) {
            if (now > val.resetAt) store.delete(key);
        }
    }, 5 * 60 * 1000);
}
