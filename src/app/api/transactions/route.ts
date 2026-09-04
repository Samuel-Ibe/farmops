import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp } from "@/lib/api-auth";
import { validate, createTransactionSchema } from "@/lib/api-validations";
import { parsePaginationParams, paginatedResponse, cachedJsonResponse } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const batchId = searchParams.get("batchId");
    const pagination = parsePaginationParams(searchParams, { limit: 20 });

    const where = {
      ...(type && { type: type as any }),
      ...(batchId && { batchId }),
    };

    const [transactions, total] = await Promise.all([
      prisma.stockTransaction.findMany({
        where,
        include: {
          batch: { include: { item: true } },
          fromWarehouse: true,
          toWarehouse: true,
          performedBy: { select: { name: true, role: true } },
          farm: true,
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.offset,
        take: pagination.limit,
      }),
      prisma.stockTransaction.count({ where }),
    ]);

    return cachedJsonResponse(transactions, 15);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const validation = validate(createTransactionSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, details: validation.details }, { status: 400 });
    }

    const { type, batchId, fromWarehouseId, toWarehouseId, quantity, reason, referenceNumber, farmId } = validation.data;

    const batch = await prisma.inventoryBatch.findUnique({ where: { id: batchId } });
    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

    if (type !== "RECEIVED" && type !== "RETURNED" && quantity > batch.quantityRemaining) {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
    }

    const unitCost = Number(batch.purchasePrice);
    const totalValue = unitCost * quantity;

    const transaction = await prisma.stockTransaction.create({
      data: {
        type, batchId,
        fromWarehouseId: fromWarehouseId || undefined,
        toWarehouseId: toWarehouseId || undefined,
        quantity, unitCost, totalValue,
        reason: reason || undefined,
        referenceNumber: referenceNumber || undefined,
        performedById: user.id,
        farmId: farmId || undefined,
      },
      include: {
        batch: { include: { item: true } },
        fromWarehouse: true, toWarehouse: true,
        performedBy: { select: { name: true, role: true } },
      },
    });

    let newQuantity = batch.quantityRemaining;
    if (type === "RECEIVED" || type === "RETURNED") newQuantity += quantity;
    else newQuantity -= quantity;

    await prisma.inventoryBatch.update({
      where: { id: batchId },
      data: { quantityRemaining: Math.max(0, newQuantity), status: newQuantity <= 0 ? "DEPLETED" : batch.status },
    });

    await writeAuditLog({ userId: user.id, action: "CREATE", entity: "StockTransaction", entityId: transaction.id, newValues: { type, batchId, quantity }, ipAddress: getClientIp(request) });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
