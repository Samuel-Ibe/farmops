import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, requireAuth, resolveFarmScope } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    const warehouseId = searchParams.get("warehouseId");
    const farmScope = resolveFarmScope(user, searchParams.get("farmId"));

    const batches = await prisma.inventoryBatch.findMany({
      where: {
        ...(itemId && { itemId }),
        ...(warehouseId && { warehouseId }),
        ...(farmScope !== null && { warehouse: { farmId: farmScope } }),
      },
      include: {
        item: true,
        warehouse: { include: { farm: true } },
        supplier: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(batches);
  } catch (error) {
    console.error("Error fetching batches:", error);
    return NextResponse.json(
      { error: "Failed to fetch batches" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (guard instanceof NextResponse) return guard;
    const body = await request.json();
    const {
      itemId,
      batchNumber,
      warehouseId,
      supplierId,
      quantityReceived,
      purchasePrice,
      manufactureDate,
      expiryDate,
      purchaseDate,
    } = body;

    // Check for duplicate batch number
    const existing = await prisma.inventoryBatch.findFirst({
      where: { batchNumber },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Batch number already exists" },
        { status: 409 }
      );
    }

    const batch = await prisma.inventoryBatch.create({
      data: {
        itemId,
        batchNumber,
        warehouseId,
        supplierId: supplierId || null,
        quantity: quantityReceived,
        quantityRemaining: quantityReceived,
        purchasePrice: purchasePrice || 0,
        manufacturedDate: manufactureDate ? new Date(manufactureDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      },
      include: {
        item: true,
        warehouse: true,
        supplier: true,
      },
    });

    // Create a RECEIVED transaction
    await prisma.stockTransaction.create({
      data: {
        type: "RECEIVED",
        batchId: batch.id,
        toWarehouseId: warehouseId,
        performedById: "system",
        quantity: quantityReceived,
        unitCost: purchasePrice || 0,
        totalValue: (purchasePrice || 0) * quantityReceived,
        reason: `Initial batch receipt: ${batchNumber}`,
      },
    });

    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    console.error("Error creating batch:", error);
    return NextResponse.json(
      { error: "Failed to create batch" },
      { status: 500 }
    );
  }
}
