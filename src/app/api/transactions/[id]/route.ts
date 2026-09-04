import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hasMinRole, writeAuditLog, getClientIp, mutationGuard } from "@/lib/api-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transaction = await prisma.stockTransaction.findUnique({
      where: { id },
      include: {
        batch: { include: { item: true } },
        fromWarehouse: true,
        toWarehouse: true,
        performedBy: { select: { name: true, role: true } },
        farm: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json({ error: "Failed to fetch transaction" }, { status: 500 });
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

    const existing = await prisma.stockTransaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Transactions are mostly immutable, but allow updating reason and referenceNumber
    const allowedFields: Record<string, any> = {};
    if (body.reason !== undefined) allowedFields.reason = body.reason;
    if (body.referenceNumber !== undefined) allowedFields.referenceNumber = body.referenceNumber;
    if (body.farmId !== undefined) allowedFields.farmId = body.farmId;

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.stockTransaction.update({
      where: { id },
      data: allowedFields,
      include: {
        batch: { include: { item: true } },
        fromWarehouse: true,
        toWarehouse: true,
        performedBy: { select: { name: true, role: true } },
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "StockTransaction",
      entityId: id,
      oldValues: { reason: existing.reason, referenceNumber: existing.referenceNumber },
      newValues: allowedFields,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
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

    const existing = await prisma.stockTransaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Restore batch quantity before deleting
    const batch = await prisma.inventoryBatch.findUnique({ where: { id: existing.batchId } });
    if (batch) {
      let newQty = batch.quantityRemaining;
      if (existing.type === "RECEIVED" || existing.type === "RETURNED") {
        newQty -= existing.quantity;
      } else {
        newQty += existing.quantity;
      }

      await prisma.inventoryBatch.update({
        where: { id: existing.batchId },
        data: {
          quantityRemaining: Math.max(0, newQty),
          status: batch.status === "DEPLETED" && newQty > 0 ? "ACTIVE" : batch.status,
        },
      });
    }

    await prisma.stockTransaction.delete({ where: { id } });

    await writeAuditLog({
      userId: user.id,
      action: "DELETE",
      entity: "StockTransaction",
      entityId: id,
      oldValues: { type: existing.type, batchId: existing.batchId, quantity: Number(existing.quantity) },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ message: "Transaction deleted" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
