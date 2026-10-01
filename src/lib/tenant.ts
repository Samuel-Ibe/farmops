/**
 * Pure tenant-scope and RBAC helpers.
 *
 * Kept free of framework/database imports so route guards, background jobs and
 * unit tests can share exactly one implementation of the authorization rules
 * (the "authorization source of truth" for tenant access is the authenticated
 * user's farm scope — never a client-supplied farmId).
 */

export const NO_FARM_MATCH = "__no_farm__";

export interface ScopeUser {
  role: string;
  farmId?: string | null;
}

/**
 * The client may *request* a farm filter, but the effective scope always comes
 * from the session. Admins may scope to any farm (or none); everyone else is
 * pinned to their own farm. NO_FARM_MATCH can never equal a real (cuid) id, so
 * a user with no farm assigned matches nothing instead of everything.
 */
export function resolveFarmScope(
  user: ScopeUser,
  requested?: string | null
): string | null {
  if (user.role === "ADMIN") return requested || null;
  return user.farmId || NO_FARM_MATCH;
}

// Role hierarchy: ADMIN > FARM_MANAGER > WAREHOUSE_MANAGER > ACCOUNTANT > FIELD_WORKER
export const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 100,
  FARM_MANAGER: 80,
  WAREHOUSE_MANAGER: 60,
  ACCOUNTANT: 40,
  FIELD_WORKER: 20,
};

export function hasRole(user: ScopeUser, roles: string[]): boolean {
  return roles.includes(user.role);
}

export function hasMinRole(user: ScopeUser, minRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[user.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * A warehouse may only take part in a mutation when it belongs to the
 * caller's farm. Validated independently of any other entity in the request
 * (a valid batch ID must never smuggle a foreign warehouse ID past the guard).
 * Admins may operate across farms; users without a farm match nothing.
 */
export function warehouseInScope(
  user: ScopeUser,
  warehouseFarmId: string | null | undefined
): boolean {
  if (user.role === "ADMIN") return true;
  if (!user.farmId) return false;
  return warehouseFarmId === user.farmId;
}
