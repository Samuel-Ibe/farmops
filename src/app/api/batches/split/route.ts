import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp, resolveFarmScope, withIdempotency } from "@/lib/api-auth";
import { applyStockDelta } from "@/lib/stock";
import { logRouteError } from "@/lib/logger";

/**
 * POST /api/batches/split
 * Split a batch into two: reduces quantity on the source batch and creates a new batch
 * with the split quantity (optionally in a different warehouse).
 *
 * Body: {
 *   batchId: string,
 *   splitQuantity: number,
 *   targetWarehouseId?: string,
 *   newBatchNumber?: string,
 *   notes?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (user instanceof NextResponse) return user;
    const farmScope = resolveFarmScope(user);

    const body = await request.json();
    const { batchId, splitQuantity, targetWarehouseId, newBatchNumber, notes } = body;

    if (!batchId || !splitQuantity || splitQuantity <= 0) {
      return NextResponse.json(
        { error: "batchId and positive splitQuantity are required" },
        { status: 400 }
      );
    }

    return await withIdempotency(request, `POST /api/batches/split:${user.id}`, async () => {
    const sourceBatch = await prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      include: { item: true, warehouse: true },
    });

    if (!sourceBatch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Ownership: non-admins may only split batches inside their own farm
    if (farmScope !== null && sourceBatch.warehouse.farmId !== farmScope) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    if (sourceBatch.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only ACTIVE batches can be split" },
        { status: 400 }
      );
    }

    if (splitQuantity >= sourceBatch.quantityRemaining) {
      return NextResponse.json(
        { error: "Split quantity must be less than the remaining quantity" },
        { status: 400 }
      );
    }

    const targetWarehouseIdFinal = targetWarehouseId || sourceBatch.warehouseId;

    // Verify target warehouse exists
    const targetWarehouse = await prisma.warehouse.findUnique({
      where: { id: targetWarehouseIdFinal },
    });
    if (!targetWarehouse) {
      return NextResponse.json({ error: "Target warehouse not found" }, { status: 404 });
    }
    if (farmScope !== null && targetWarehouse.farmId !== farmScope) {
      return NextResponse.json({ error: "Target warehouse not found" }, { status: 404 });
    }

    // Generate batch number if not provided
    const batchNum =
      newBatchNumber ||
      `${sourceBatch.batchNumber}-S${Date.now().toString(36).toUpperCase()}`;

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Reduce source batch quantity — conditional UPDATE re-checks the
      //    remaining quantity under the row lock (concurrent spend → 409,
      //    never a negative or double-spent batch).
      const adjustment = await applyStockDelta(tx, batchId, -splitQuantity);
      if (!adjustment.ok) return { error: adjustment } as const;

      const updatedSource = await tx.inventoryBatch.findUnique({
        where: { id: batchId },
      });
      if (!updatedSource) {
        return { error: { reason: "BATCH_NOT_FOUND", available: 0 } } as const;
      }

      // 2. Create new batch with split quantity
      const newBatch = await tx.inventoryBatch.create({
        data: {
          itemId: sourceBatch.itemId,
          batchNumber: batchNum,
          supplierId: sourceBatch.supplierId,
          purchasePrice: sourceBatch.purchasePrice,
          currentUnitCost: sourceBatch.currentUnitCost || sourceBatch.purchasePrice,
          quantity: splitQuantity,
          quantityRemaining: splitQuantity,
          unitCostAtEntry: sourceBatch.unitCostAtEntry || sourceBatch.purchasePrice,
          warehouseId: targetWarehouseIdFinal,
          expiryDate: sourceBatch.expiryDate,
          manufacturedDate: sourceBatch.manufacturedDate,
          barcode: null,
          qrCodeData: null,
          purchaseDate: sourceBatch.purchaseDate,
          status: "ACTIVE",
          notes: notes || `Split from batch ${sourceBatch.batchNumber}`,
        },
        include: { item: true, warehouse: true },
      });

      // 3. Create two audit-trail transactions
      const fromWarehouse = sourceBatch.warehouseId;
      const toWarehouse = targetWarehouseIdFinal;

      // Transfer out from source
      await tx.stockTransaction.create({
        data: {
          type: "TRANSFERRED",
          batchId: batchId,
          fromWarehouseId: fromWarehouse,
          toWarehouseId: null,
          quantity: splitQuantity,
          unitCost: sourceBatch.currentUnitCost || sourceBatch.purchasePrice,
          totalValue:
            Number(sourceBatch.currentUnitCost || sourceBatch.purchasePrice) *
            splitQuantity,
          reason: `Batch split — ${splitQuantity} ${sourceBatch.item.unitOfMeasure} moved to batch ${batchNum}`,
          performedById: user.id,
        },
      });

      // Transfer in to new batch
      await tx.stockTransaction.create({
        data: {
          type: "TRANSFERRED",
          batchId: newBatch.id,
          fromWarehouseId: null,
          toWarehouseId: toWarehouse,
          quantity: splitQuantity,
          unitCost: sourceBatch.currentUnitCost || sourceBatch.purchasePrice,
          totalValue:
            Number(sourceBatch.currentUnitCost || sourceBatch.purchasePrice) *
            splitQuantity,
          reason: `Batch split — received ${splitQuantity} ${sourceBatch.item.unitOfMeasure} from batch ${sourceBatch.batchNumber}`,
          performedById: user.id,
        },
      });

      return { updatedSource, newBatch };
    });

    if (result.error) {
      if (result.error.reason === "BATCH_NOT_FOUND") {
        return NextResponse.json({ error: "Batch not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Insufficient stock", available: result.error.available ?? 0 },
        { status: 409 }
      );
    }

    // Audit log
    await writeAuditLog({
      userId: user.id,
      action: "BATCH_SPLIT",
      entity: "InventoryBatch",
      entityId: batchId,
      oldValues: { quantityRemaining: Number(sourceBatch.quantityRemaining) },
      newValues: {
        newBatchId: result.newBatch.id,
        newBatchNumber: batchNum,
        splitQuantity,
        sourceRemaining: Number(result.updatedSource.quantityRemaining),
        targetWarehouseId: targetWarehouseIdFinal,
      },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(
      {
        message: "Batch split successfully",
        sourceBatch: result.updatedSource,
        newBatch: result.newBatch,
      },
      { status: 201 }
    );
    });
  } catch (error) {
    logRouteError(request, "Error splitting batch", error);
    return NextResponse.json(
      { error: "Failed to split batch" },
      { status: 500 }
    );
  }
}
