import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog } from "@/lib/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (user instanceof NextResponse) return user;

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      categoryId,
      unitOfMeasure,
      description,
      minimumStockLevel,
      maximumStockLevel,
      reorderPoint,
      reorderQuantity,
      defaultSupplierId,
      shelfLifeDays,
      requiresExpiryTracking,
    } = body;

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(categoryId && { categoryId }),
        ...(unitOfMeasure && { unitOfMeasure }),
        ...(description !== undefined && { description }),
        ...(minimumStockLevel !== undefined && { minimumStockLevel }),
        ...(maximumStockLevel !== undefined && { maximumStockLevel }),
        ...(reorderPoint !== undefined && { reorderPoint }),
        ...(reorderQuantity !== undefined && { reorderQuantity }),
        ...(defaultSupplierId !== undefined && { defaultSupplierId }),
        ...(shelfLifeDays !== undefined && { shelfLifeDays }),
        ...(requiresExpiryTracking !== undefined && { requiresExpiryTracking }),
      },
      include: { category: true },
    });

    // Audit log
    await writeAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "InventoryItem",
      entityId: id,
      newValues: { name, categoryId, unitOfMeasure },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating inventory item:", error);
    return NextResponse.json(
      { error: "Failed to update inventory item" },
      { status: 500 }
    );
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

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: { batches: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.batches.length > 0) {
      await prisma.inventoryItem.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ message: "Item deactivated" });
    }

    await prisma.inventoryItem.delete({ where: { id } });
    return NextResponse.json({ message: "Item deleted" });
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
