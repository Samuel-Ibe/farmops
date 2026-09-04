import { describe, it, expect } from "vitest";
import {
  createApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
} from "@/lib/api-keys";

describe("API Key Management", () => {
  it("creates a new API key", () => {
    const key = createApiKey("Test Key", ["read:inventory"]);
    expect(key.id).toMatch(/^key_/);
    expect(key.key).toMatch(/^fops_/);
    expect(key.name).toBe("Test Key");
    expect(key.permissions).toEqual(["read:inventory"]);
    expect(key.isActive).toBe(true);
    expect(key.usageCount).toBe(0);
  });

  it("validates an active API key", () => {
    const key = createApiKey("Valid Key", ["read:inventory"]);
    const validated = validateApiKey(key.key);
    expect(validated).toBeTruthy();
    expect(validated?.name).toBe("Valid Key");
  });

  it("returns null for invalid key", () => {
    const result = validateApiKey("fops_invalid_key_12345");
    expect(result).toBeNull();
  });

  it("increments usage count on validation", () => {
    const key = createApiKey("Usage Key", ["read:batches"]);
    validateApiKey(key.key);
    validateApiKey(key.key);
    const validated = validateApiKey(key.key);
    expect(validated?.usageCount).toBeGreaterThanOrEqual(3);
  });

  it("revokes a key", () => {
    const key = createApiKey("Revoke Key", ["read:inventory"]);
    const result = revokeApiKey(key.id);
    expect(result).toBe(true);
    // After revocation, validation should fail
    const validated = validateApiKey(key.key);
    expect(validated).toBeNull();
  });

  it("returns false when revoking non-existent key", () => {
    const result = revokeApiKey("nonexistent");
    expect(result).toBe(false);
  });

  it("lists all API keys", () => {
    const list = listApiKeys();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it("creates keys with multiple permissions", () => {
    const key = createApiKey("Multi-Perm Key", [
      "read:inventory",
      "write:batches",
      "read:transactions",
    ]);
    expect(key.permissions.length).toBe(3);
  });
});
