import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp, requireAuth, resolveFarmScope } from "@/lib/api-auth";

// Stock counts are scoped to the warehouse's farm
function farmScopeWhere(user: { role: string; farmId?: string | null }) {
  const farmScope = resolveFarmScope(user as any);
  return farmScope !== null ? { warehouse: { farmId: farmScope } } : {};
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const { id } = await params;

    const stockCount = await prisma.stockCount.findFirst({
      where: { id, ...farmScopeWhere(user) },
      include: {
        warehouse: true,
        countedBy: { select: { name: true, role: true } },
        items: {
          include: {
            batch: {
              include: { item: true },
            },
          },
        },
      },
    });

    if (!stockCount) {
      return NextResponse.json({ error: "Stock count not found" }, { status: 404 });
    }

    return NextResponse.json(stockCount);
  } catch (error) {
    console.error("Error fetching stock count:", error);
    return NextResponse.json({ error: "Failed to fetch stock count" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (user instanceof NextResponse) return user;

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.stockCount.findFirst({
      where: { id, ...farmScopeWhere(user) },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Stock count not found" }, { status: 404 });
    }

    const allowedUpdates: Record<string, any> = {};

    // Status update: IN_PROGRESS -> COMPLETED -> RECONCILED
    if (body.status) {
      const validTransitions: Record<string, string[]> = {
        IN_PROGRESS: ["COMPLETED"],
        COMPLETED: ["RECONCILED"],
      };

      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${body.status}` },
          { status: 400 }
        );
      }
      allowedUpdates.status = body.status;
    }

    if (body.notes !== undefined) {
      allowedUpdates.notes = body.notes;
    }

    // Update item quantities if provided
    if (body.items && Array.isArray(body.items)) {
      for (const itemUpdate of body.items) {
        if (itemUpdate.id && itemUpdate.countedQuantity !== undefined) {
          const countItem = await prisma.stockCountItem.findUnique({
            where: { id: itemUpdate.id },
          });
          if (countItem && countItem.stockCountId === id) {
            const variance = itemUpdate.countedQuantity - Number(countItem.systemQuantity);
            await prisma.stockCountItem.update({
              where: { id: itemUpdate.id },
              data: {
                countedQuantity: itemUpdate.countedQuantity,
                variance,
                notes: itemUpdate.notes || countItem.notes,
              },
            });

            // If reconciling, apply variance to the actual batch
            if (body.status === "RECONCILED" && variance !== 0) {
              const batch = await prisma.inventoryBatch.findUnique({
                where: { id: countItem.batchId },
              });
              if (batch) {
                const newQuantity = Number(batch.quantityRemaining) + variance;
                await prisma.inventoryBatch.update({
                  where: { id: batch.id },
                  data: {
                    quantityRemaining: Math.max(0, newQuantity),
                    status: newQuantity <= 0 ? "DEPLETED" : batch.status,
                  },
                });

                // Record the adjustment as a transaction
                await prisma.stockTransaction.create({
                  data: {
                    type: variance > 0 ? "RECEIVED" : "ADJUSTED",
                    batchId: batch.id,
                    quantity: Math.abs(variance),
                    unitCost: Number(batch.purchasePrice),
                    totalValue: Math.abs(variance) * Number(batch.purchasePrice),
                    reason: `Stock count reconciliation - variance of ${variance > 0 ? "+" : ""}${variance}`,
                    performedById: user.id,
                  },
                });
              }
            }
          }
        }
      }
    }

    if (Object.keys(allowedUpdates).length === 0 && !body.items) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.stockCount.update({
      where: { id },
      data: allowedUpdates,
      include: {
        warehouse: true,
        countedBy: { select: { name: true } },
        items: {
          include: {
            batch: { include: { item: true } },
          },
        },
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "StockCount",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: allowedUpdates.status || existing.status },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating stock count:", error);
    return NextResponse.json({ error: "Failed to update stock count" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await mutationGuard(request, { minRole: "ADMIN" });
    if (user instanceof NextResponse) return user;

    const { id } = await params;

    const existing = await prisma.stockCount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Stock count not found" }, { status: 404 });
    }

    if (existing.status === "RECONCILED") {
      return NextResponse.json(
        { error: "Cannot delete a reconciled stock count" },
        { status: 400 }
      );
    }

    // Delete items first, then the stock count
    await prisma.stockCountItem.deleteMany({ where: { stockCountId: id } });
    await prisma.stockCount.delete({ where: { id } });

    await writeAuditLog({
      userId: user.id,
      action: "DELETE",
      entity: "StockCount",
      entityId: id,
      oldValues: { warehouseId: existing.warehouseId, status: existing.status },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ message: "Stock count deleted" });
  } catch (error) {
    console.error("Error deleting stock count:", error);
    return NextResponse.json({ error: "Failed to delete stock count" }, { status: 500 });
  }
}
