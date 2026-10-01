import { describe, it, expect, beforeEach } from "vitest";
import {
  beginIdempotency,
  completeIdempotency,
  isValidIdempotencyKey,
  releaseIdempotency,
  resetIdempotency,
} from "@/lib/idempotency";

/**
 * Duplicate-mutation safety: browser double-clicks, network retries and
 * client retry logic must produce exactly one effective operation.
 */
describe("Idempotency", () => {
  beforeEach(() => resetIdempotency());

  it("claims a fresh key exactly once", () => {
    expect(beginIdempotency("scope:abc")).toEqual({ outcome: "fresh" });
  });

  it("reports in-flight while the original request is running", () => {
    beginIdempotency("scope:abc");
    expect(beginIdempotency("scope:abc")).toEqual({ outcome: "inflight" });
  });

  it("replays the stored successful response for a duplicate", () => {
    beginIdempotency("scope:abc");
    completeIdempotency("scope:abc", 201, { id: "txn_1" });

    const replay = beginIdempotency("scope:abc");
    expect(replay.outcome).toBe("replay");
    if (replay.outcome === "replay") {
      expect(replay.record.status).toBe(201);
      expect(replay.record.body).toEqual({ id: "txn_1" });
    }
  });

  it("one effective operation: two attempts → one execution, one replay", () => {
    expect(beginIdempotency("scope:dup").outcome).toBe("fresh");
    completeIdempotency("scope:dup", 201, { count: 1 });
    expect(beginIdempotency("scope:dup").outcome).toBe("replay");
    expect(beginIdempotency("scope:dup").outcome).toBe("replay");
  });

  it("does not store failed responses — a corrected retry may run", () => {
    beginIdempotency("scope:fail");
    completeIdempotency("scope:fail", 400, { error: "bad" });
    expect(beginIdempotency("scope:fail").outcome).toBe("fresh");
  });

  it("releases a crashed request's claim", () => {
    beginIdempotency("scope:crash");
    releaseIdempotency("scope:crash");
    expect(beginIdempotency("scope:crash").outcome).toBe("fresh");
  });

  it("scopes keys independently", () => {
    beginIdempotency("user_a:POST /api/transactions:k1");
    completeIdempotency("user_a:POST /api/transactions:k1", 201, { a: true });
    // Same key from a different user must not replay another user's response
    expect(beginIdempotency("user_b:POST /api/transactions:k1").outcome).toBe("fresh");
  });

  it("validates key length bounds", () => {
    expect(isValidIdempotencyKey("")).toBe(false);
    expect(isValidIdempotencyKey("order-123")).toBe(true);
    expect(isValidIdempotencyKey("x".repeat(200))).toBe(true);
    expect(isValidIdempotencyKey("x".repeat(201))).toBe(false);
  });
});
