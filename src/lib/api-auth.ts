import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  NO_FARM_MATCH,
  hasMinRole,
  hasRole,
  resolveFarmScope,
} from "@/lib/tenant";
import {
  beginIdempotency,
  completeIdempotency,
  isValidIdempotencyKey,
  releaseIdempotency,
} from "@/lib/idempotency";

// Pure authorization rules live in @/lib/tenant so tests and non-HTTP code
// share exactly one implementation. Re-exported here for route ergonomics.
export { NO_FARM_MATCH, hasMinRole, hasRole, resolveFarmScope };
// Rate limiting lives in @/lib/rate-limit (also imported by the NextAuth
// authorize callback — importing this module there would cycle).
export { checkRateLimit };

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  farmId?: string | null;
}

// ─── Session Extraction ─────────────────────────────────────

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const session = await auth();
    if (!session?.user) return null;
    return {
      id: (session.user as any).id,
      name: session.user.name || "",
      email: session.user.email || "",
      role: (session.user as any).role || "",
      farmId: (session.user as any).farmId ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AuthUser | NextResponse> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  return user;
}

// ─── Role-Based Access Control ──────────────────────────────

export async function requireRole(
  roles: string[]
): Promise<AuthUser | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (!hasRole(result, roles)) {
    return NextResponse.json(
      { error: "Insufficient permissions", required: roles },
      { status: 403 }
    );
  }
  return result;
}

export async function requireMinRole(
  minRole: string
): Promise<AuthUser | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (!hasMinRole(result, minRole)) {
    return NextResponse.json(
      { error: "Insufficient permissions", required: `At least ${minRole}` },
      { status: 403 }
    );
  }
  return result;
}

// ─── Request Metadata ───────────────────────────────────────

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { error: "Rate limit exceeded. Try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(resetAt),
      },
    }
  );
}

// ─── CSRF Protection ────────────────────────────────────────

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function checkCsrf(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) return false;

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export function csrfErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: "CSRF validation failed" },
    { status: 403 }
  );
}

// ─── Idempotency ────────────────────────────────────────────

/**
 * Run a mutation at most once per `Idempotency-Key` header value.
 *
 * - No header → handler runs normally (idempotency is opt-in).
 * - Duplicate key → the stored successful response is replayed with
 *   `Idempotent-Replay: true`.
 * - Concurrent duplicate → 409 while the original request is in flight.
 * - Non-2xx / thrown → the key is released so a corrected retry can run.
 *
 * `scope` should identify the route and the acting user, so two users (or two
 * endpoints) can never share a key's recorded response.
 */
export async function withIdempotency(
  request: Request,
  scope: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const rawKey = request.headers.get("idempotency-key");
  if (!rawKey) return handler();

  const key = rawKey.trim();
  if (!isValidIdempotencyKey(key)) {
    return NextResponse.json(
      { error: "Invalid Idempotency-Key header" },
      { status: 400 }
    );
  }

  const scopeKey = `${scope}:${key}`;
  const check = beginIdempotency(scopeKey);

  if (check.outcome === "inflight") {
    return NextResponse.json(
      { error: "A request with this Idempotency-Key is already in progress" },
      { status: 409 }
    );
  }
  if (check.outcome === "replay") {
    return NextResponse.json(check.record.body as Record<string, unknown>, {
      status: check.record.status,
      headers: { "Idempotent-Replay": "true" },
    });
  }

  try {
    const response = await handler();
    if (response.ok) {
      let body: unknown = null;
      try {
        body = await response.clone().json();
      } catch {
        body = null;
      }
      completeIdempotency(scopeKey, response.status, body);
    } else {
      releaseIdempotency(scopeKey);
    }
    return response;
  } catch (err) {
    releaseIdempotency(scopeKey);
    throw err;
  }
}

// ─── Audit Logging ──────────────────────────────────────────

export async function writeAuditLog(data: {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
}) {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.auditLog.create({
      data: {
        userId: data.userId || undefined,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        oldValues: data.oldValues || undefined,
        newValues: data.newValues || undefined,
        ipAddress: data.ipAddress || undefined,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// ─── Combined Guard for Mutations ───────────────────────────

export async function mutationGuard(
  request: Request,
  options: {
    roles?: string[];
    minRole?: string;
    rateLimit?: { maxRequests: number; windowMs: number };
  } = {}
): Promise<AuthUser | NextResponse> {
  // CSRF check
  if (!checkCsrf(request)) {
    return csrfErrorResponse();
  }

  // Rate limit
  const ip = getClientIp(request);
  const rl = options.rateLimit || { maxRequests: 30, windowMs: 60000 };
  const { allowed, resetAt } = checkRateLimit(`mutate:${ip}`, rl.maxRequests, rl.windowMs);
  if (!allowed) {
    return rateLimitResponse(resetAt);
  }

  // Role check
  if (options.minRole) {
    return requireMinRole(options.minRole);
  }
  if (options.roles) {
    return requireRole(options.roles);
  }

  return requireAuth();
}
