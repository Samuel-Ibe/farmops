import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
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

export function hasRole(user: AuthUser, roles: string[]): boolean {
  return roles.includes(user.role);
}

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

// Role hierarchy: ADMIN > FARM_MANAGER > WAREHOUSE_MANAGER > ACCOUNTANT > FIELD_WORKER
const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 100,
  FARM_MANAGER: 80,
  WAREHOUSE_MANAGER: 60,
  ACCOUNTANT: 40,
  FIELD_WORKER: 20,
};

export function hasMinRole(user: AuthUser, minRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[user.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
  return userLevel >= requiredLevel;
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

// ─── Rate Limiting (in-memory, per-IP) ──────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
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
