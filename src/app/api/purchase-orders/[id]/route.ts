import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog } from "@/lib/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await mutationGuard(request, { minRole: "FARM_MANAGER" });
    if (user instanceof NextResponse) return user;

    const { id } = await params;
    const body = await request.json();
    const { status, notes, actualDeliveryDate } = body;

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    // Ownership: non-admins may only touch POs belonging to their own farm
    if (user.role !== "ADMIN" && po.farmId !== user.farmId) {
      return NextResponse.json({ error: "Purchase order belongs to another farm" }, { status: 403 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (actualDeliveryDate) updateData.actualDeliveryDate = new Date(actualDeliveryDate);

    // If received, create stock entries for each PO item
    if (status === "RECEIVED" && po.status !== "RECEIVED") {
      updateData.actualDeliveryDate = updateData.actualDeliveryDate || new Date();
      
      const poItems = await prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      for (const poItem of poItems) {
        // Find existing batch for this item in any warehouse for this farm
        const existingBatch = await prisma.inventoryBatch.findFirst({
          where: {
            itemId: poItem.itemId,
            status: "ACTIVE",
          },
        });

        if (existingBatch) {
          // Update existing batch
          await prisma.inventoryBatch.update({
            where: { id: existingBatch.id },
            data: {
              quantity: existingBatch.quantity + poItem.quantity,
              quantityRemaining: existingBatch.quantityRemaining + poItem.quantity,
            },
          });
        } else {
          // Create new batch
          await prisma.inventoryBatch.create({
            data: {
              itemId: poItem.itemId,
              batchNumber: `PO-${po.orderNumber}-${poItem.id.slice(-6)}`,
              supplierId: po.supplierId,
              purchasePrice: poItem.unitPrice,
              quantity: poItem.quantity,
              quantityRemaining: poItem.quantity,
              warehouseId: (await prisma.warehouse.findFirst({ where: { farmId: po.farmId } }))?.id || "",
              status: "ACTIVE",
              purchaseDate: new Date(),
              notes: `Received from PO ${po.orderNumber}`,
            },
          });
        }

        // Mark PO item as fully received
        await prisma.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { quantityReceived: poItem.quantity },
        });
      }
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: { items: { include: { item: true } }, supplier: true, farm: true },
    });

    // Audit log
    await writeAuditLog({
      userId: user?.id,
      action: status ? `STATUS_${status}` : "UPDATE",
      entity: "PurchaseOrder",
      entityId: id,
      oldValues: { status: po.status },
      newValues: { status: status || po.status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating purchase order:", error);
    return NextResponse.json({ error: "Failed to update purchase order" }, { status: 500 });
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

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    if (po.status !== "DRAFT" && po.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Only draft or cancelled POs can be deleted" },
        { status: 400 }
      );
    }

    // Delete PO items first
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    await prisma.purchaseOrder.delete({ where: { id } });

    return NextResponse.json({ message: "Purchase order deleted" });
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    return NextResponse.json({ error: "Failed to delete purchase order" }, { status: 500 });
  }
}
