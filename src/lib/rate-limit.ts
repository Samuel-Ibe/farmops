/**
 * Fixed-window rate limiting and login-failure throttling.
 *
 * Pure in-memory implementation with no framework imports so it can be used
 * from both route guards and the NextAuth authorize callback (importing the
 * route-guard module there would create an import cycle), and unit-tested in
 * isolation. State survives only for the lifetime of a single process —
 * before horizontal scaling, move to shared infrastructure (see
 * docs/SECURITY_AUDIT.md SEC-18).
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt };
}

export function resetRateLimits(): void {
  rateLimitStore.clear();
}

// ─── Login Throttling ──────────────────────────────────────
//
// Counts *failed* login attempts only, keyed by client-IP + account so an
// attacker cannot lock a victim out of their own account from elsewhere
// (no easy account-lockout DoS). Successful logins clear the counter.

const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;

const loginFailures = new Map<string, number[]>(); // key -> failed-attempt timestamps

function pruneFailures(key: string, now: number): number[] {
  const attempts = (loginFailures.get(key) || []).filter(
    (t) => now - t < LOGIN_FAILURE_WINDOW_MS
  );
  if (attempts.length === 0) loginFailures.delete(key);
  else loginFailures.set(key, attempts);
  return attempts;
}

/**
 * Returns true when this login attempt must be rejected before doing any
 * credential work (too many recent failures for this IP+account pair).
 */
export function isLoginThrottled(key: string): boolean {
  const attempts = pruneFailures(key, Date.now());
  return attempts.length >= LOGIN_FAILURE_LIMIT;
}

/** Records a failed credential check. Returns true if the key is now throttled. */
export function recordLoginFailure(key: string): boolean {
  const now = Date.now();
  const attempts = pruneFailures(key, now);
  attempts.push(now);
  loginFailures.set(key, attempts);
  return attempts.length >= LOGIN_FAILURE_LIMIT;
}

/** Clears failures for a key — called after a successful login. */
export function clearLoginFailures(key: string): void {
  loginFailures.delete(key);
}

export function resetLoginFailures(): void {
  loginFailures.clear();
}
