import crypto from "crypto";

export interface ApiKey {
  id: string;
  /** Plaintext key — only ever present in the create response. Reads return
   *  the stored hint (`fops_…abcd`), never the usable secret. */
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

interface ApiKeyRecord {
  id: string;
  /** SHA-256 of the plaintext key — the database/store never holds a usable secret. */
  keyHash: string;
  /** Display-only hint so operators can recognise a key they issued. */
  keyHint: string;
  name: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  usageCount: number;
  farmId?: string | null;
}

// In-memory store (for demo; production would use DB — hashed, as here).
const recordsByHash = new Map<string, ApiKeyRecord>();
const recordsById = new Map<string, ApiKeyRecord>();

function generateApiKey(): string {
  return `fops_${crypto.randomBytes(32).toString("hex")}`;
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function keyHint(key: string): string {
  return `${key.slice(0, 9)}…${key.slice(-4)}`;
}

function toApiKey(record: ApiKeyRecord, plaintext?: string): ApiKey {
  return {
    id: record.id,
    key: plaintext ?? record.keyHint,
    name: record.name,
    permissions: [...record.permissions],
    isActive: record.isActive,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    usageCount: record.usageCount,
    farmId: record.farmId ?? null,
  };
}

/**
 * Create a key. The plaintext secret is returned exactly once (here); only
 * its SHA-256 digest is retained for future validation.
 */
export function createApiKey(name: string, permissions: string[], farmId?: string | null): ApiKey {
  const id = `key_${Date.now().toString(36)}`;
  const plaintext = generateApiKey();
  const record: ApiKeyRecord = {
    id,
    keyHash: hashKey(plaintext),
    keyHint: keyHint(plaintext),
    name,
    permissions,
    isActive: true,
    createdAt: new Date().toISOString(),
    usageCount: 0,
    farmId: farmId ?? null,
  };
  recordsByHash.set(record.keyHash, record);
  recordsById.set(id, record);
  return toApiKey(record, plaintext);
}

/** Validate a presented key by hashing it — the store is never searched by plaintext. */
export function validateApiKey(key: string): ApiKey | null {
  const record = recordsByHash.get(hashKey(key));
  if (!record || !record.isActive) return null;
  record.lastUsedAt = new Date().toISOString();
  record.usageCount++;
  return toApiKey(record);
}

/** Scope check: each key is limited to its explicit permissions. */
export function hasPermission(apiKey: ApiKey, scope: string): boolean {
  return apiKey.permissions.includes(scope) || apiKey.permissions.includes("*");
}

export function revokeApiKey(id: string): boolean {
  const record = recordsById.get(id);
  if (!record) return false;
  record.isActive = false;
  return true;
}

export function listApiKeys(): ApiKey[] {
  return Array.from(recordsById.values()).map((record) => toApiKey(record));
}

// Seed a demo key (integration example; still stored hashed)
createApiKey("FarmOps External Connector", ["read:inventory", "read:batches", "read:transactions", "write:webhooks"]);
