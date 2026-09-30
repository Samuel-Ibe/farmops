import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp } from "@/lib/api-auth";
import { validate, updateRequestSchema } from "@/lib/api-validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only managers and above can approve/reject
    const user = await mutationGuard(request, { minRole: "FARM_MANAGER" });
    if (user instanceof NextResponse) return user;

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validation = validate(updateRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, details: validation.details }, { status: 400 });
    }

    const { status, reviewNote, approvedQuantity } = validation.data;

    const existing = await prisma.resourceRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Ownership: non-admins may only review requests from their own farm
    if (user.role !== "ADMIN" && existing.farmId !== user.farmId) {
      return NextResponse.json({ error: "Request belongs to another farm" }, { status: 403 });
    }

    const updateData: any = {
      status,
      reviewedById: user.id,
      reviewedAt: new Date(),
    };

    if (reviewNote !== undefined) updateData.reviewNote = reviewNote;
    if (approvedQuantity !== undefined) updateData.approvedQuantity = approvedQuantity;

    // If approving, mark as fulfilled
    if (status === "APPROVED") {
      updateData.fulfilledAt = new Date();
      updateData.approvedQuantity = approvedQuantity || existing.quantity;
    }

    // If approved and has a warehouse, create a stock issue transaction
    if (status === "APPROVED" && existing.warehouseId) {
      const batch = await prisma.inventoryBatch.findFirst({
        where: {
          itemId: existing.itemId,
          warehouseId: existing.warehouseId,
          status: "ACTIVE",
          quantityRemaining: { gte: approvedQuantity || existing.quantity },
        },
      });

      if (batch) {
        const issueQty = approvedQuantity || existing.quantity;
        const unitCost = Number(batch.purchasePrice);

        await prisma.stockTransaction.create({
          data: {
            type: "ISSUED",
            batchId: batch.id,
            fromWarehouseId: existing.warehouseId,
            quantity: issueQty,
            unitCost,
            totalValue: unitCost * issueQty,
            reason: `Fulfilled from request ${existing.requestNumber}`,
            referenceNumber: existing.requestNumber,
            performedById: user.id,
            farmId: existing.farmId,
          },
        });

        const newQty = batch.quantityRemaining - issueQty;
        await prisma.inventoryBatch.update({
          where: { id: batch.id },
          data: {
            quantityRemaining: newQty,
            status: newQty <= 0 ? "DEPLETED" : batch.status,
          },
        });
      }
    }

    const resourceRequest = await prisma.resourceRequest.update({
      where: { id },
      data: updateData,
      include: {
        item: true,
        farm: true,
        requestedBy: { select: { name: true, role: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: `REQUEST_${status}`,
      entity: "ResourceRequest",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status, reviewNote, approvedQuantity },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(resourceRequest);
  } catch (error) {
    console.error("Error updating request:", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
