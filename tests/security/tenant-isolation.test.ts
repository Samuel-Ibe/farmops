import { describe, it, expect } from "vitest";
import {
  NO_FARM_MATCH,
  hasMinRole,
  hasRole,
  resolveFarmScope,
  warehouseInScope,
} from "@/lib/tenant";

/**
 * Adversarial tenant-isolation matrix (Farm A vs Farm B).
 *
 * These encode the security invariants from the production-elevation
 * recommendations as permanent regression tests: no caller-supplied ID may
 * move a user's effective scope across a farm boundary, and role escalation
 * attempts must fail closed.
 */

const farmAUser = { role: "WAREHOUSE_MANAGER", farmId: "farm_A" };
const farmBUser = { role: "FARM_MANAGER", farmId: "farm_B" };
const admin = { role: "ADMIN", farmId: null };
const unassignedWorker = { role: "FIELD_WORKER", farmId: null };

describe("Tenant isolation — resolveFarmScope", () => {
  it("pins a non-admin to their own farm regardless of requested farmId", () => {
    expect(resolveFarmScope(farmAUser, "farm_B")).toBe("farm_A");
    expect(resolveFarmScope(farmAUser, null)).toBe("farm_A");
    expect(resolveFarmScope(farmAUser, undefined)).toBe("farm_A");
  });

  it("Farm A scope never equals Farm B", () => {
    expect(resolveFarmScope(farmAUser)).not.toBe(resolveFarmScope(farmBUser));
  });

  it("lets admins scope to any farm (or none)", () => {
    expect(resolveFarmScope(admin, "farm_A")).toBe("farm_A");
    expect(resolveFarmScope(admin, "farm_B")).toBe("farm_B");
    expect(resolveFarmScope(admin, null)).toBeNull();
  });

  it("returns NO_FARM_MATCH for users with no farm — fail-closed, never global", () => {
    expect(resolveFarmScope(unassignedWorker)).toBe(NO_FARM_MATCH);
    expect(resolveFarmScope(unassignedWorker, "farm_A")).toBe(NO_FARM_MATCH);
    // The sentinel can never equal a real (cuid) id
    expect(NO_FARM_MATCH).not.toBe("farm_A");
  });
});

describe("Tenant isolation — warehouse relationships", () => {
  it("rejects Farm A acting on a Farm B warehouse", () => {
    expect(warehouseInScope(farmAUser, "farm_B")).toBe(false);
  });

  it("allows Farm A acting on its own warehouse", () => {
    expect(warehouseInScope(farmAUser, "farm_A")).toBe(true);
  });

  it("rejects warehouse use for users with no farm", () => {
    expect(warehouseInScope(unassignedWorker, "farm_A")).toBe(false);
    expect(warehouseInScope(unassignedWorker, null)).toBe(false);
  });

  it("rejects a missing/null warehouse farmId for non-admins", () => {
    expect(warehouseInScope(farmAUser, null)).toBe(false);
    expect(warehouseInScope(farmAUser, undefined)).toBe(false);
  });

  it("allows admins cross-farm (explicit, audited privilege)", () => {
    expect(warehouseInScope(admin, "farm_B")).toBe(true);
  });
});

describe("Role escalation attempts", () => {
  it("field worker cannot perform admin actions", () => {
    expect(hasMinRole(unassignedWorker, "ADMIN")).toBe(false);
  });

  it("field worker cannot approve as farm manager", () => {
    expect(hasMinRole(unassignedWorker, "FARM_MANAGER")).toBe(false);
  });

  it("warehouse manager meets warehouse mutations but not approval thresholds", () => {
    expect(hasMinRole(farmAUser, "WAREHOUSE_MANAGER")).toBe(true);
    expect(hasMinRole(farmAUser, "FARM_MANAGER")).toBe(false);
    expect(hasMinRole(farmAUser, "ADMIN")).toBe(false);
  });

  it("unknown roles fail closed to level 0", () => {
    expect(hasMinRole({ role: "SUPERUSER", farmId: "farm_A" }, "FIELD_WORKER")).toBe(false);
    expect(hasRole({ role: "SUPERUSER", farmId: "farm_A" }, ["ADMIN"])).toBe(false);
  });

  it("farm manager outranks warehouse manager", () => {
    expect(hasMinRole(farmBUser, "WAREHOUSE_MANAGER")).toBe(true);
    expect(hasMinRole(farmAUser, "FARM_MANAGER")).toBe(false);
  });
});
