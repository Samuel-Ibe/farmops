import { describe, it, expect } from "vitest";
import { createApiKey, hasPermission, listApiKeys, revokeApiKey, validateApiKey } from "@/lib/api-keys";

/**
 * API keys must never be stored usable: the store keeps only a SHA-256
 * digest, reads expose a display hint, and each key is confined to its
 * explicit scopes.
 */
describe("API key hashing at rest", () => {
  it("returns the plaintext exactly once — at creation", () => {
    const created = createApiKey("Hash Test", ["read:inventory"]);
    expect(created.key).toMatch(/^fops_/);
    expect(validateApiKey(created.key)).not.toBeNull();
  });

  it("listApiKeys never exposes a usable secret", () => {
    const created = createApiKey("List Test", ["read:inventory"]);
    const listed = listApiKeys().find((k) => k.id === created.id);
    expect(listed).toBeDefined();
    expect(listed!.key).not.toBe(created.key);
    expect(listed!.key).toContain("…"); // display hint only
    // The leaked list entry cannot be used as a credential
    expect(validateApiKey(listed!.key)).toBeNull();
  });

  it("rejects tampered or unknown keys", () => {
    const created = createApiKey("Tamper Test", ["read:inventory"]);
    expect(validateApiKey(created.key.slice(0, -1))).toBeNull();
    expect(validateApiKey("fops_deadbeef")).toBeNull();
    expect(validateApiKey("")).toBeNull();
  });

  it("stops validating after revocation", () => {
    const created = createApiKey("Revoke Hash Test", ["read:inventory"]);
    expect(revokeApiKey(created.id)).toBe(true);
    expect(validateApiKey(created.key)).toBeNull();
  });
});

describe("API key scope enforcement", () => {
  it("permits only explicitly granted scopes", () => {
    const key = createApiKey("Scoped", ["read:inventory"]);
    expect(hasPermission(key, "read:inventory")).toBe(true);
    expect(hasPermission(key, "read:transactions")).toBe(false);
    expect(hasPermission(key, "write:webhooks")).toBe(false);
  });

  it("supports a wildcard scope for admin-issued keys", () => {
    const key = createApiKey("Wildcard", ["*"]);
    expect(hasPermission(key, "read:inventory")).toBe(true);
    expect(hasPermission(key, "anything:else")).toBe(true);
  });

  it("cross-farm reads stay gated by scope before any query runs", () => {
    const readOnly = createApiKey("ReadOnly", ["read:batches"], "farm_A");
    expect(hasPermission(readOnly, "read:inventory")).toBe(false);
    expect(hasPermission(readOnly, "read:batches")).toBe(true);
    // tenant pinning is independent of scopes
    expect(readOnly.farmId).toBe("farm_A");
  });
});
