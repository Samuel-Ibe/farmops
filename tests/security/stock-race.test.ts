import { describe, it, expect } from "vitest";
import type { Prisma } from "@prisma/client";
import { applyStockDelta, isInboundTransactionType, transactionTypeDelta } from "@/lib/stock";

/**
 * Concurrency tests for atomic stock mutations.
 *
 * Acceptance criterion from the production-elevation recommendations:
 * with 100 units available, two concurrent requests for 80 units must not
 * produce negative stock or 160 units of successful issuance.
 *
 * The in-memory tx stub mirrors the database contract used by applyStockDelta:
 * `updateMany` evaluates its WHERE predicate and applies the mutation in one
 * atomic step against the row (as Postgres does under the row lock), so any
 * interleaving of helper calls can never lose the predicate check.
 */

interface Row {
  quantityRemaining: number;
  status: string;
}

function makeTx(row: Row | null) {
  const state = row ? { ...row } : null;

  const tx = {
    inventoryBatch: {
      async findUnique() {
        if (!state) return null;
        return { quantityRemaining: state.quantityRemaining, status: state.status };
      },
      async updateMany(args: {
        where: {
          id?: string;
          status?: string;
          quantityRemaining?: { gte?: number; gt?: number; lte?: number };
        };
        data: {
          quantityRemaining?: { decrement?: number; increment?: number };
          status?: string;
        };
      }) {
        if (!state) return { count: 0 };
        const w = args.where;
        if (w.status !== undefined && state.status !== w.status) return { count: 0 };
        if (w.quantityRemaining) {
          const { gte, gt, lte } = w.quantityRemaining;
          if (gte !== undefined && !(state.quantityRemaining >= gte)) return { count: 0 };
          if (gt !== undefined && !(state.quantityRemaining > gt)) return { count: 0 };
          if (lte !== undefined && !(state.quantityRemaining <= lte)) return { count: 0 };
        }
        // Predicate passed → apply atomically
        const q = args.data.quantityRemaining;
        if (q?.decrement !== undefined) state.quantityRemaining -= q.decrement;
        if (q?.increment !== undefined) state.quantityRemaining += q.increment;
        if (args.data.status !== undefined) state.status = args.data.status;
        return { count: 1 };
      },
    },
  };
  return {
    tx: tx as unknown as Prisma.TransactionClient,
    state,
  };
}

describe("applyStockDelta — atomic decrement", () => {
  it("accepts a withdrawal within available stock", async () => {
    const { tx, state } = makeTx({ quantityRemaining: 100, status: "ACTIVE" });
    const result = await applyStockDelta(tx, "batch_1", -30);
    expect(result.ok).toBe(true);
    expect(result.ok && result.quantityRemaining).toBe(70);
    expect(state!.quantityRemaining).toBe(70);
  });

  it("rejects a withdrawal larger than available stock without mutating", async () => {
    const { tx, state } = makeTx({ quantityRemaining: 50, status: "ACTIVE" });
    const result = await applyStockDelta(tx, "batch_1", -80);
    expect(result).toEqual({ ok: false, reason: "INSUFFICIENT_STOCK", available: 50 });
    expect(state!.quantityRemaining).toBe(50);
  });

  it("ACCEPTANCE: two concurrent 80-unit draws against 100 → exactly one succeeds", async () => {
    const { tx, state } = makeTx({ quantityRemaining: 100, status: "ACTIVE" });
    const [first, second] = await Promise.all([
      applyStockDelta(tx, "batch_1", -80),
      applyStockDelta(tx, "batch_1", -80),
    ]);
    const successes = [first, second].filter((r) => r.ok);
    const failures = [first, second].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ reason: "INSUFFICIENT_STOCK" });
    // 100 - 80 = 20 — never negative, never 160 issued
    expect(state!.quantityRemaining).toBe(20);
  });

  it("sequential overdraws deplete deterministically instead of going negative", async () => {
    const { tx, state } = makeTx({ quantityRemaining: 100, status: "ACTIVE" });
    expect((await applyStockDelta(tx, "b", -60)).ok).toBe(true);
    expect((await applyStockDelta(tx, "b", -60)).ok).toBe(false);
    expect(state!.quantityRemaining).toBe(40);
  });

  it("marks the batch DEPLETED when stock hits exactly zero", async () => {
    const { tx, state } = makeTx({ quantityRemaining: 40, status: "ACTIVE" });
    await applyStockDelta(tx, "b", -40);
    expect(state!.quantityRemaining).toBe(0);
    expect(state!.status).toBe("DEPLETED");
  });

  it("reactivates a DEPLETED batch when stock arrives", async () => {
    const { tx, state } = makeTx({ quantityRemaining: 0, status: "DEPLETED" });
    const result = await applyStockDelta(tx, "b", 25);
    expect(result.ok).toBe(true);
    expect(state!.quantityRemaining).toBe(25);
    expect(state!.status).toBe("ACTIVE");
  });

  it("returns BATCH_NOT_FOUND for a missing batch", async () => {
    const { tx } = makeTx(null);
    const result = await applyStockDelta(tx, "ghost", -10);
    expect(result).toEqual({ ok: false, reason: "BATCH_NOT_FOUND" });
  });

  it("honours requireActive when the batch is not ACTIVE", async () => {
    const { tx, state } = makeTx({ quantityRemaining: 100, status: "DEPLETED" });
    const result = await applyStockDelta(tx, "b", -10, { requireActive: true });
    expect(result.ok).toBe(false);
    expect(state!.quantityRemaining).toBe(100);
  });
});

describe("applyStockDelta — increment", () => {
  it("adds stock without a pre-check race", async () => {
    const { tx, state } = makeTx({ quantityRemaining: 5, status: "ACTIVE" });
    await Promise.all([
      applyStockDelta(tx, "b", 10),
      applyStockDelta(tx, "b", 10),
    ]);
    expect(state!.quantityRemaining).toBe(25);
  });

  it("zero delta is a no-op read", async () => {
    const { tx, state } = makeTx({ quantityRemaining: 5, status: "ACTIVE" });
    const result = await applyStockDelta(tx, "b", 0);
    expect(result.ok && result.quantityRemaining).toBe(5);
    expect(state!.quantityRemaining).toBe(5);
  });
});

describe("transaction type deltas", () => {
  it("classifies inbound vs outbound types", () => {
    expect(isInboundTransactionType("RECEIVED")).toBe(true);
    expect(isInboundTransactionType("RETURNED")).toBe(true);
    expect(isInboundTransactionType("ISSUED")).toBe(false);
    expect(isInboundTransactionType("TRANSFERRED")).toBe(false);
    expect(isInboundTransactionType("ADJUSTED")).toBe(false);
    expect(isInboundTransactionType("WASTED")).toBe(false);
  });

  it("maps types to signed quantity deltas", () => {
    expect(transactionTypeDelta("RECEIVED", 10)).toBe(10);
    expect(transactionTypeDelta("RETURNED", 10)).toBe(10);
    expect(transactionTypeDelta("ISSUED", 10)).toBe(-10);
    expect(transactionTypeDelta("ADJUSTED", 10)).toBe(-10);
  });
});
