import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp, withIdempotency } from "@/lib/api-auth";
import { validate, updateRequestSchema } from "@/lib/api-validations";
import { applyStockDelta } from "@/lib/stock";
import { logRouteError } from "@/lib/logger";

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

    return await withIdempotency(request, `PATCH /api/requests:${user.id}`, async () => {
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

    // Approval and stock issuance are one atomic operation: the issuance
    // uses a conditional UPDATE, so approving the same batch twice (or a
    // concurrent spend) can never over-issue — it returns 409 and the
    // approval is not recorded.
    const outcome = await prisma.$transaction(async (tx) => {
      if (status === "APPROVED" && existing.warehouseId) {
        const batch = await tx.inventoryBatch.findFirst({
          where: {
            itemId: existing.itemId,
            warehouseId: existing.warehouseId,
            status: "ACTIVE",
            quantityRemaining: { gte: approvedQuantity || existing.quantity },
          },
        });

        if (batch) {
          const issueQty = approvedQuantity || existing.quantity;
          const adjustment = await applyStockDelta(tx, batch.id, -issueQty);
          if (!adjustment.ok) return { error: adjustment } as const;

          const unitCost = Number(batch.purchasePrice);
          await tx.stockTransaction.create({
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
        }
      }

      const resourceRequest = await tx.resourceRequest.update({
        where: { id },
        data: updateData,
        include: {
          item: true,
          farm: true,
          requestedBy: { select: { name: true, role: true } },
          reviewedBy: { select: { name: true } },
        },
      });
      return { resourceRequest } as const;
    });

    if (outcome.error) {
      return NextResponse.json(
        {
          error: "Insufficient stock to fulfil this request",
          available: outcome.error.available ?? 0,
        },
        { status: 409 }
      );
    }

    const resourceRequest = outcome.resourceRequest;

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
    });
  } catch (error) {
    logRouteError(request, "Error updating request", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
