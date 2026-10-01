import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, writeAuditLog, getClientIp, mutationGuard } from "@/lib/api-auth";
import { applyStockDelta, transactionTypeDelta } from "@/lib/stock";
import { logRouteError } from "@/lib/logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;

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

    // Ownership: non-admins only see their own farm's transactions
    if (user.role !== "ADMIN" && transaction.farmId !== user.farmId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    logRouteError(request, "Error fetching transaction", error);
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

    // Ownership: non-admins may only edit their own farm's transactions
    if (user.role !== "ADMIN" && existing.farmId !== user.farmId) {
      return NextResponse.json({ error: "Transaction belongs to another farm" }, { status: 403 });
    }

    // Transactions are mostly immutable, but allow updating reason and referenceNumber
    const allowedFields: Record<string, any> = {};
    if (body.reason !== undefined) allowedFields.reason = body.reason;
    if (body.referenceNumber !== undefined) allowedFields.referenceNumber = body.referenceNumber;
    // Re-stamping farmId is an admin-only correction
    if (body.farmId !== undefined && user.role === "ADMIN") allowedFields.farmId = body.farmId;

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
    logRouteError(request, "Error updating transaction", error);
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

    // Reverse the quantity effect and delete the record atomically. The
    // conditional UPDATE means reverting an inbound receipt can never drive
    // stock negative (concurrent consumption) — it returns a 409 instead.
    const reverseDelta = -transactionTypeDelta(existing.type, existing.quantity);
    const outcome = await prisma.$transaction(async (tx) => {
      const adjustment = await applyStockDelta(tx, existing.batchId, reverseDelta);
      if (!adjustment.ok) return { error: adjustment } as const;
      await tx.stockTransaction.delete({ where: { id } });
      return { ok: true } as const;
    });

    if (outcome.error) {
      if (outcome.error.reason === "INSUFFICIENT_STOCK") {
        return NextResponse.json(
          {
            error: "Cannot delete: the stock recorded by this transaction has already been consumed",
            available: outcome.error.available ?? 0,
          },
          { status: 409 }
        );
      }
      // Batch no longer exists — remove the orphaned transaction record.
      await prisma.stockTransaction.delete({ where: { id } });
    }

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
    logRouteError(request, "Error deleting transaction", error);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
