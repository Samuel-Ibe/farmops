/**
 * Atomic stock-quantity mutations.
 *
 * Every change to `InventoryBatch.quantityRemaining` must go through these
 * helpers. They use conditional UPDATEs (Prisma `updateMany` with a predicate)
 * executed inside the caller's transaction, so the read-validate-write cycle
 * can never be interleaved with a concurrent request: Postgres re-evaluates
 * the WHERE clause against the locked row, and a lost race yields a
 * deterministic conflict instead of negative or duplicated stock.
 *
 * Acceptance invariant: with 100 units available, two concurrent requests for
 * 80 units must not produce negative stock or 160 units of issuance — the
 * second conditional update matches zero rows and returns INSUFFICIENT_STOCK.
 */

import type { Prisma } from "@prisma/client";

export type StockAdjustmentResult =
  | { ok: true; quantityRemaining: number; status: string }
  | { ok: false; reason: "BATCH_NOT_FOUND" | "INSUFFICIENT_STOCK"; available?: number };

export interface StockDeltaOptions {
  /** Require the batch to be ACTIVE before applying the delta. */
  requireActive?: boolean;
  /**
   * When a decrement would push stock to zero or below, fail instead of
   * landing exactly on zero. Default: false (decrement is applied only when
   * at least `qty` is available, so the result is never negative).
   */
  allowExactZero?: boolean;
}

/** Inbound types add stock; every other type removes stock. */
export function isInboundTransactionType(type: string): boolean {
  return type === "RECEIVED" || type === "RETURNED";
}

/** Signed quantity delta implied by a stock transaction type. */
export function transactionTypeDelta(type: string, quantity: number): number {
  return isInboundTransactionType(type) ? quantity : -quantity;
}

/**
 * Apply a signed delta to a batch's remaining quantity, atomically.
 *
 * - Negative deltas (removals) only succeed when the batch currently holds at
 *   least the requested quantity — the predicate is checked by the database
 *   under the row lock, not by a prior read in application code.
 * - Status is synchronised after the change inside the same transaction:
 *   qty <= 0 becomes DEPLETED; stock arriving at a DEPLETED batch reactivates
 *   it to ACTIVE (otherwise a received/deleted-then-restored batch would stay
 *   DEPLETED forever while holding stock).
 *
 * Must be called inside a `prisma.$transaction` callback with the tx client.
 */
export async function applyStockDelta(
  tx: Prisma.TransactionClient,
  batchId: string,
  delta: number,
  options: StockDeltaOptions = {}
): Promise<StockAdjustmentResult> {
  if (delta === 0) {
    const row = await tx.inventoryBatch.findUnique({
      where: { id: batchId },
      select: { quantityRemaining: true, status: true },
    });
    return row
      ? { ok: true, quantityRemaining: row.quantityRemaining, status: row.status }
      : { ok: false, reason: "BATCH_NOT_FOUND" };
  }

  const removing = delta < 0;
  const qty = Math.abs(delta);

  const where: Prisma.InventoryBatchWhereInput = { id: batchId };
  if (options.requireActive) where.status = "ACTIVE";
  if (removing) {
    where.quantityRemaining = options.allowExactZero ? { gt: 0 } : { gte: qty };
  }

  const updated = await tx.inventoryBatch.updateMany({
    where,
    data: removing
      ? { quantityRemaining: { decrement: qty } }
      : { quantityRemaining: { increment: qty } },
  });

  if (updated.count === 0) {
    // Distinguish "batch gone" from "predicate lost the race".
    const row = await tx.inventoryBatch.findUnique({
      where: { id: batchId },
      select: { quantityRemaining: true, status: true },
    });
    if (!row) return { ok: false, reason: "BATCH_NOT_FOUND" };
    if (removing) {
      return { ok: false, reason: "INSUFFICIENT_STOCK", available: row.quantityRemaining };
    }
    // requireActive failed (or the row vanished between statements)
    return { ok: false, reason: "BATCH_NOT_FOUND" };
  }

  const after = await tx.inventoryBatch.findUnique({
    where: { id: batchId },
    select: { quantityRemaining: true, status: true },
  });
  if (!after) return { ok: false, reason: "BATCH_NOT_FOUND" };

  if (after.quantityRemaining <= 0 && after.status !== "DEPLETED") {
    await tx.inventoryBatch.updateMany({
      where: { id: batchId, quantityRemaining: { lte: 0 } },
      data: { status: "DEPLETED" },
    });
    return { ok: true, quantityRemaining: after.quantityRemaining, status: "DEPLETED" };
  }
  if (after.quantityRemaining > 0 && after.status === "DEPLETED") {
    await tx.inventoryBatch.updateMany({
      where: { id: batchId, quantityRemaining: { gt: 0 } },
      data: { status: "ACTIVE" },
    });
    return { ok: true, quantityRemaining: after.quantityRemaining, status: "ACTIVE" };
  }

  return { ok: true, quantityRemaining: after.quantityRemaining, status: after.status };
}
