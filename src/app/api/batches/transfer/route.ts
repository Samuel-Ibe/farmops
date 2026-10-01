import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp, resolveFarmScope, withIdempotency } from "@/lib/api-auth";
import { applyStockDelta } from "@/lib/stock";
import { logRouteError } from "@/lib/logger";

/**
 * POST /api/batches/transfer
 * Transfer stock from one warehouse to another.
 * Creates new batch at destination (or adds to existing batch for same item),
 * reduces source batch, and records the transaction.
 *
 * Body: {
 *   batchId: string,
 *   toWarehouseId: string,
 *   quantity: number,
 *   notes?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (user instanceof NextResponse) return user;
    const farmScope = resolveFarmScope(user);

    const body = await request.json();
    const { batchId, toWarehouseId, quantity, notes } = body;

    if (!batchId || !toWarehouseId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: "batchId, toWarehouseId, and positive quantity are required" },
        { status: 400 }
      );
    }

    return await withIdempotency(request, `POST /api/batches/transfer:${user.id}`, async () => {
    const sourceBatch = await prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      include: { item: true, warehouse: true },
    });

    if (!sourceBatch) {
      return NextResponse.json({ error: "Source batch not found" }, { status: 404 });
    }

    // Ownership: non-admins may only move stock inside their own farm
    if (farmScope !== null && sourceBatch.warehouse.farmId !== farmScope) {
      return NextResponse.json({ error: "Source batch not found" }, { status: 404 });
    }

    if (sourceBatch.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only ACTIVE batches can be transferred" },
        { status: 400 }
      );
    }

    if (quantity > sourceBatch.quantityRemaining) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${sourceBatch.quantityRemaining}` },
        { status: 400 }
      );
    }

    if (sourceBatch.warehouseId === toWarehouseId) {
      return NextResponse.json(
        { error: "Source and destination warehouses must be different" },
        { status: 400 }
      );
    }

    const targetWarehouse = await prisma.warehouse.findUnique({
      where: { id: toWarehouseId },
    });
    if (!targetWarehouse) {
      return NextResponse.json({ error: "Destination warehouse not found" }, { status: 404 });
    }
    if (farmScope !== null && targetWarehouse.farmId !== farmScope) {
      return NextResponse.json({ error: "Destination warehouse not found" }, { status: 404 });
    }

    // Check if destination already has an active batch for the same item
    const existingDestBatch = await prisma.inventoryBatch.findFirst({
      where: {
        itemId: sourceBatch.itemId,
        warehouseId: toWarehouseId,
        status: "ACTIVE",
        expiryDate: sourceBatch.expiryDate,
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Reduce source batch — conditional UPDATE re-checks available
      //    quantity under the row lock, so a concurrent transfer of the same
      //    stock loses deterministically (409) instead of going negative.
      const adjustment = await applyStockDelta(tx, batchId, -quantity);
      if (!adjustment.ok) return { error: adjustment } as const;

      const updatedSource = await tx.inventoryBatch.findUnique({
        where: { id: batchId },
      });
      if (!updatedSource) return { error: { reason: "BATCH_NOT_FOUND", available: 0 } } as const;

      let destinationBatch;

      if (existingDestBatch) {
        // Add to existing batch at destination — atomic increments; two
        // concurrent transfers into the same batch must both land.
        await tx.inventoryBatch.updateMany({
          where: { id: existingDestBatch.id },
          data: {
            quantity: { increment: quantity },
            quantityRemaining: { increment: quantity },
          },
        });
        destinationBatch = await tx.inventoryBatch.findUnique({
          where: { id: existingDestBatch.id },
          include: { item: true, warehouse: true },
        });
      } else {
        // Create new batch at destination
        const transferBatchNum = `${sourceBatch.batchNumber}-T${Date.now().toString(36).toUpperCase()}`;
        destinationBatch = await tx.inventoryBatch.create({
          data: {
            itemId: sourceBatch.itemId,
            batchNumber: transferBatchNum,
            supplierId: sourceBatch.supplierId,
            purchasePrice: sourceBatch.purchasePrice,
            currentUnitCost: sourceBatch.currentUnitCost || sourceBatch.purchasePrice,
            quantity,
            quantityRemaining: quantity,
            unitCostAtEntry: sourceBatch.unitCostAtEntry || sourceBatch.purchasePrice,
            warehouseId: toWarehouseId,
            expiryDate: sourceBatch.expiryDate,
            manufacturedDate: sourceBatch.manufacturedDate,
            purchaseDate: sourceBatch.purchaseDate,
            status: "ACTIVE",
            notes: `Transferred from ${sourceBatch.warehouse.name} (batch ${sourceBatch.batchNumber})`,
          },
          include: { item: true, warehouse: true },
        });
      }

      // 2. Record the transfer transaction
      const unitCost = Number(sourceBatch.currentUnitCost || sourceBatch.purchasePrice);
      await tx.stockTransaction.create({
        data: {
          type: "TRANSFERRED",
          batchId: batchId,
          fromWarehouseId: sourceBatch.warehouseId,
          toWarehouseId,
          quantity,
          unitCost,
          totalValue: unitCost * quantity,
          reason: notes || `Transfer ${quantity} ${sourceBatch.item.unitOfMeasure} from ${sourceBatch.warehouse.name} to ${targetWarehouse.name}`,
          performedById: user.id,
        },
      });

      return { updatedSource, destinationBatch };
    });

    if (result.error) {
      if (result.error.reason === "BATCH_NOT_FOUND") {
        return NextResponse.json({ error: "Source batch not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Insufficient stock", available: result.error.available ?? 0 },
        { status: 409 }
      );
    }

    // Audit log
    await writeAuditLog({
      userId: user.id,
      action: "STOCK_TRANSFER",
      entity: "InventoryBatch",
      entityId: batchId,
      oldValues: { quantityRemaining: Number(sourceBatch.quantityRemaining) },
      newValues: {
        transferred: quantity,
        fromWarehouse: sourceBatch.warehouse.name,
        toWarehouse: targetWarehouse.name,
        sourceRemaining: Number(result.updatedSource.quantityRemaining),
      },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(
      {
        message: "Transfer completed successfully",
        sourceBatch: result.updatedSource,
        destinationBatch: result.destinationBatch,
      },
      { status: 201 }
    );
    });
  } catch (error) {
    logRouteError(request, "Error transferring stock", error);
    return NextResponse.json(
      { error: "Failed to transfer stock" },
      { status: 500 }
    );
  }
}
