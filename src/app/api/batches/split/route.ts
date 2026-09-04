import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp } from "@/lib/api-auth";

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

    const body = await request.json();
    const { batchId, splitQuantity, targetWarehouseId, newBatchNumber, notes } = body;

    if (!batchId || !splitQuantity || splitQuantity <= 0) {
      return NextResponse.json(
        { error: "batchId and positive splitQuantity are required" },
        { status: 400 }
      );
    }

    const sourceBatch = await prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      include: { item: true, warehouse: true },
    });

    if (!sourceBatch) {
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

    // Generate batch number if not provided
    const batchNum =
      newBatchNumber ||
      `${sourceBatch.batchNumber}-S${Date.now().toString(36).toUpperCase()}`;

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Reduce source batch quantity
      const updatedSource = await tx.inventoryBatch.update({
        where: { id: batchId },
        data: {
          quantityRemaining: sourceBatch.quantityRemaining - splitQuantity,
          status:
            sourceBatch.quantityRemaining - splitQuantity <= 0
              ? "DEPLETED"
              : sourceBatch.status,
        },
      });

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
  } catch (error) {
    console.error("Error splitting batch:", error);
    return NextResponse.json(
      { error: "Failed to split batch" },
      { status: 500 }
    );
  }
}
