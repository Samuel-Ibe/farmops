import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  mutationGuard,
  writeAuditLog,
  getClientIp,
  requireAuth,
  resolveFarmScope,
  withIdempotency,
} from "@/lib/api-auth";
import { validate, createTransactionSchema } from "@/lib/api-validations";
import { parsePaginationParams, paginatedResponse, cachedJsonResponse } from "@/lib/pagination";
import { applyStockDelta, transactionTypeDelta } from "@/lib/stock";
import { logRouteError } from "@/lib/logger";
import { warehouseInScope } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const batchId = searchParams.get("batchId");
    const farmId = resolveFarmScope(user, searchParams.get("farmId"));
    const pagination = parsePaginationParams(searchParams, { limit: 20 });

    const where = {
      ...(type && { type: type as any }),
      ...(batchId && { batchId }),
      ...(farmId && { farmId }),
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
    logRouteError(request, "Error fetching transactions", error);
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

    return await withIdempotency(request, `POST /api/transactions:${user.id}`, async () => {
      const batch = await prisma.inventoryBatch.findUnique({ where: { id: batchId }, include: { warehouse: true } });
      if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

      // Ownership: non-admins may only transact against batches in their own farm
      if (user.role !== "ADMIN" && batch.warehouse?.farmId !== user.farmId) {
        return NextResponse.json({ error: "Batch belongs to another farm" }, { status: 403 });
      }

      // Every warehouse relationship is validated against the tenant scope on
      // its own — a valid batch ID must never smuggle a foreign warehouse ID.
      if (fromWarehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: fromWarehouseId } });
        if (!wh) return NextResponse.json({ error: "Source warehouse not found" }, { status: 404 });
        if (!warehouseInScope(user, wh.farmId)) {
          return NextResponse.json({ error: "Source warehouse not available for your farm" }, { status: 403 });
        }
      }
      if (toWarehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: toWarehouseId } });
        if (!wh) return NextResponse.json({ error: "Destination warehouse not found" }, { status: 404 });
        if (!warehouseInScope(user, wh.farmId)) {
          return NextResponse.json({ error: "Destination warehouse not available for your farm" }, { status: 403 });
        }
      }

      // Friendly pre-check; the authoritative guard is the conditional
      // UPDATE inside the transaction below.
      const delta = transactionTypeDelta(type, quantity);
      if (delta < 0 && quantity > batch.quantityRemaining) {
        return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
      }

      const unitCost = Number(batch.purchasePrice);
      const totalValue = unitCost * quantity;

      // Stock deduction/accrual and the transaction record are atomic: the
      // conditional UPDATE re-checks quantity under the row lock, so a lost
      // race returns a deterministic conflict instead of negative stock.
      const outcome = await prisma.$transaction(async (tx) => {
        const adjustment = await applyStockDelta(tx, batchId, delta);
        if (!adjustment.ok) return { error: adjustment } as const;

        const transaction = await tx.stockTransaction.create({
          data: {
            type, batchId,
            fromWarehouseId: fromWarehouseId || undefined,
            toWarehouseId: toWarehouseId || undefined,
            quantity, unitCost, totalValue,
            reason: reason || undefined,
            referenceNumber: referenceNumber || undefined,
            performedById: user.id,
            farmId: user.role === "ADMIN" ? farmId || undefined : user.farmId || undefined,
          },
          include: {
            batch: { include: { item: true } },
            fromWarehouse: true, toWarehouse: true,
            performedBy: { select: { name: true, role: true } },
          },
        });
        return { transaction } as const;
      });

      if (outcome.error) {
        if (outcome.error.reason === "BATCH_NOT_FOUND") {
          return NextResponse.json({ error: "Batch not found" }, { status: 404 });
        }
        // Lost race / concurrent spend: report the true remaining quantity.
        return NextResponse.json(
          { error: "Insufficient stock", available: outcome.error.available ?? 0 },
          { status: 409 }
        );
      }

      await writeAuditLog({ userId: user.id, action: "CREATE", entity: "StockTransaction", entityId: outcome.transaction.id, newValues: { type, batchId, quantity }, ipAddress: getClientIp(request) });

      return NextResponse.json(outcome.transaction, { status: 201 });
    });
  } catch (error) {
    logRouteError(request, "Error creating transaction", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
