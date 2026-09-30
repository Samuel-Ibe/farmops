import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp, requireAuth, resolveFarmScope } from "@/lib/api-auth";
import { validate, createStockCountSchema } from "@/lib/api-validations";
import { parsePaginationParams, cachedJsonResponse } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const farmScope = resolveFarmScope(user, searchParams.get("farmId"));
    const where = farmScope !== null ? { warehouse: { farmId: farmScope } } : {};
    const pagination = parsePaginationParams(searchParams, { limit: 20 });
    const [counts, total] = await Promise.all([
      prisma.stockCount.findMany({
        where,
        include: {
          warehouse: true,
          countedBy: { select: { name: true, role: true } },
          items: { include: { batch: { include: { item: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.offset,
        take: pagination.limit,
      }),
      prisma.stockCount.count({ where }),
    ]);
    return cachedJsonResponse(counts, 30);
  } catch (error) {
    console.error("Error fetching stock counts:", error);
    return NextResponse.json({ error: "Failed to fetch stock counts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (user instanceof NextResponse) return user;
    const body = await request.json();
    const validation = validate(createStockCountSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, details: validation.details }, { status: 400 });
    }
    const { warehouseId, items, notes } = validation.data;
    // Ownership: non-admins can only count warehouses inside their own farm
    const farmScope = resolveFarmScope(user);
    const warehouse = await prisma.warehouse.findFirst({
      where: {
        id: warehouseId,
        ...(farmScope !== null ? { farmId: farmScope } : {}),
      },
      select: { id: true },
    });
    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }
    const stockCount = await prisma.stockCount.create({
      data: {
        warehouseId, countedById: user.id, countDate: new Date(),
        notes: notes || undefined, status: "COMPLETED",
        items: {
          create: items.map((item) => ({
            batchId: item.batchId, systemQuantity: item.systemQuantity,
            countedQuantity: item.countedQuantity,
            variance: item.countedQuantity - item.systemQuantity,
            notes: item.notes || undefined,
          })),
        },
      },
      include: {
        warehouse: true, countedBy: { select: { name: true } },
        items: { include: { batch: { include: { item: true } } } },
      },
    });
    await writeAuditLog({ userId: user.id, action: "CREATE", entity: "StockCount", entityId: stockCount.id, newValues: { warehouseId, itemCount: items.length }, ipAddress: getClientIp(request) });
    return NextResponse.json(stockCount, { status: 201 });
  } catch (error) {
    console.error("Error creating stock count:", error);
    return NextResponse.json({ error: "Failed to create stock count" }, { status: 500 });
  }
}
