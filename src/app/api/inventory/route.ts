import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp } from "@/lib/api-auth";
import { validate, createInventoryItemSchema } from "@/lib/api-validations";
import { parsePaginationParams, paginatedResponse, cachedJsonResponse } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId");
    const pagination = parsePaginationParams(searchParams, { limit: 50 });

    // If searching, don't paginate (return all matches for search dropdown)
    if (search || categoryId) {
      const items = await prisma.inventoryItem.findMany({
        where: {
          isActive: true,
          ...(search && { name: { contains: search, mode: "insensitive" } }),
          ...(categoryId && { categoryId }),
        },
        include: {
          category: true,
          batches: {
            where: { status: "ACTIVE" },
            include: { warehouse: { include: { farm: true } } },
          },
          _count: { select: { batches: true } },
        },
        orderBy: { name: "asc" },
        take: 50,
      });

      const itemsWithTotals = items.map((item) => ({
        ...item,
        totalQuantity: item.batches.reduce((sum, b) => sum + b.quantityRemaining, 0),
        totalValue: item.batches.reduce(
          (sum, b) => sum + Number(b.purchasePrice) * b.quantityRemaining, 0
        ),
      }));

      return cachedJsonResponse(itemsWithTotals, 10);
    }

    // Paginated list
    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { isActive: true },
        include: {
          category: true,
          batches: {
            where: { status: "ACTIVE" },
            include: { warehouse: { include: { farm: true } } },
          },
          _count: { select: { batches: true } },
        },
        orderBy: { name: "asc" },
        skip: pagination.offset,
        take: pagination.limit,
      }),
      prisma.inventoryItem.count({ where: { isActive: true } }),
    ]);

    const itemsWithTotals = items.map((item) => ({
      ...item,
      totalQuantity: item.batches.reduce((sum, b) => sum + b.quantityRemaining, 0),
      totalValue: item.batches.reduce(
        (sum, b) => sum + Number(b.purchasePrice) * b.quantityRemaining, 0
      ),
    }));

    return cachedJsonResponse(itemsWithTotals, 30);
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const validation = validate(createInventoryItemSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, details: validation.details }, { status: 400 });
    }

    const data = validation.data;
    const item = await prisma.inventoryItem.create({
      data: {
        name: data.name,
        categoryId: data.categoryId,
        unitOfMeasure: data.unitOfMeasure,
        description: data.description,
        minimumStockLevel: data.minimumStockLevel,
        maximumStockLevel: data.maximumStockLevel,
        reorderPoint: data.reorderPoint,
        reorderQuantity: data.reorderQuantity,
        defaultSupplierId: data.defaultSupplierId,
        shelfLifeDays: data.shelfLifeDays,
        requiresExpiryTracking: data.requiresExpiryTracking,
      },
      include: { category: true },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "InventoryItem",
      entityId: item.id,
      newValues: { name: data.name, categoryId: data.categoryId },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error creating inventory item:", error);
    return NextResponse.json({ error: "Failed to create inventory item" }, { status: 500 });
  }
}
