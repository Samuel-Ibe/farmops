import crypto from "crypto";

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  usageCount: number;
  /** Tenant binding: a key without farmId may read across farms (admin-issued
   *  integration key). A key with farmId is pinned to that single farm. */
  farmId?: string | null;
}

// In-memory store (for demo; production would use DB)
const apiKeys = new Map<string, ApiKey>();

function generateApiKey(): string {
  return `fops_${crypto.randomBytes(32).toString("hex")}`;
}

export function createApiKey(name: string, permissions: string[], farmId?: string | null): ApiKey {
  const id = `key_${Date.now().toString(36)}`;
  const key = generateApiKey();
  const apiKey: ApiKey = {
    id,
    key,
    name,
    permissions,
    isActive: true,
    createdAt: new Date().toISOString(),
    usageCount: 0,
    farmId: farmId ?? null,
  };
  apiKeys.set(id, apiKey);
  // Also store by key for lookup
  apiKeys.set(key, apiKey);
  return apiKey;
}

export function validateApiKey(key: string): ApiKey | null {
  const apiKey = apiKeys.get(key);
  if (!apiKey || !apiKey.isActive) return null;
  apiKey.lastUsedAt = new Date().toISOString();
  apiKey.usageCount++;
  return apiKey;
}

export function revokeApiKey(id: string): boolean {
  const apiKey = apiKeys.get(id);
  if (!apiKey) return false;
  apiKey.isActive = false;
  // Also invalidate by key
  apiKeys.delete(apiKey.key);
  return true;
}

export function listApiKeys(): ApiKey[] {
  const seen = new Set<string>();
  return Array.from(apiKeys.values()).filter((k) => {
    if (seen.has(k.id)) return false;
    seen.add(k.id);
    return true;
  });
}

// Seed a demo key
createApiKey("FarmOps External Connector", ["read:inventory", "read:batches", "read:transactions", "write:webhooks"]);
