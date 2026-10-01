/**
 * Idempotency support for state-changing endpoints.
 *
 * Clients may send an `Idempotency-Key` header with high-impact mutations
 * (stock issuance, transfer, split, adjustment, purchase-order submission,
 * approvals). The first request executes normally; its successful response is
 * stored under the key. Any duplicate — browser double-click, network retry,
 * client retry logic — replays the stored response instead of performing a
 * second operation. Failed (non-2xx) attempts release the key so a corrected
 * retry can run.
 *
 * Storage is in-memory and scoped per user + route (same single-instance
 * limitation as rate limiting — see docs/SECURITY_AUDIT.md SEC-18 before
 * scaling horizontally).
 */

export interface IdempotencyRecord {
  status: number;
  body: unknown;
  storedAt: number;
}

type IdempotencyEntry =
  | { state: "inflight" }
  | { state: "done"; record: IdempotencyRecord };

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;
const MAX_KEY_LENGTH = 200;

const store = new Map<string, IdempotencyEntry>();

function prune(now: number): void {
  if (store.size <= MAX_ENTRIES) {
    // cheap opportunistic prune: drop expired "done" entries when full
    return;
  }
  for (const [key, entry] of store) {
    if (entry.state === "done" && now - entry.record.storedAt > IDEMPOTENCY_TTL_MS) {
      store.delete(key);
    }
  }
  // Still oversized? Drop oldest done entries.
  if (store.size > MAX_ENTRIES) {
    const done: Array<[string, number]> = [];
    for (const [key, entry] of store) {
      if (entry.state === "done") done.push([key, entry.record.storedAt]);
    }
    done.sort((a, b) => a[1] - b[1]);
    for (const [key] of done.slice(0, store.size - MAX_ENTRIES)) store.delete(key);
  }
}

export function isValidIdempotencyKey(key: string): boolean {
  return key.length > 0 && key.length <= MAX_KEY_LENGTH;
}

export type IdempotencyCheck =
  | { outcome: "fresh" }
  | { outcome: "inflight" }
  | { outcome: "replay"; record: IdempotencyRecord };

/** Claim a key for execution, or discover it is already done/in-flight. */
export function beginIdempotency(scopeKey: string): IdempotencyCheck {
  const now = Date.now();
  prune(now);
  const existing = store.get(scopeKey);
  if (existing) {
    if (existing.state === "inflight") return { outcome: "inflight" };
    if (now - existing.record.storedAt > IDEMPOTENCY_TTL_MS) {
      store.delete(scopeKey);
    } else {
      return { outcome: "replay", record: existing.record };
    }
  }
  store.set(scopeKey, { state: "inflight" });
  return { outcome: "fresh" };
}

/** Store a successful response for replay. Only 2xx responses are stored. */
export function completeIdempotency(
  scopeKey: string,
  status: number,
  body: unknown
): void {
  if (status >= 200 && status < 300) {
    store.set(scopeKey, {
      state: "done",
      record: { status, body, storedAt: Date.now() },
    });
  } else {
    // Failures are not sticky — the key may be retried.
    store.delete(scopeKey);
  }
}

/** Release a claim after an unexpected exception (crash safety). */
export function releaseIdempotency(scopeKey: string): void {
  const entry = store.get(scopeKey);
  if (entry && entry.state === "inflight") store.delete(scopeKey);
}

export function resetIdempotency(): void {
  store.clear();
}
