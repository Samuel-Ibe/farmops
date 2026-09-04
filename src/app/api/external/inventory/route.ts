import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-keys";

async function authenticate(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Missing or invalid Authorization header. Use: Bearer <api_key>" }, { status: 401 }) };
  }
  const token = authHeader.slice(7);
  const apiKey = validateApiKey(token);
  if (!apiKey) {
    return { error: NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 }) };
  }
  return { apiKey };
}

/**
 * GET /api/external/inventory
 * External API: Get all inventory items with batches.
 * Requires API key in Authorization: Bearer <key>
 *
 * Query params: search, categoryId, status, page, limit
 */
export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId");
    const status = searchParams.get("status") || "ACTIVE";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const where: Record<string, unknown> = { isActive: true };
    if (search) where.name = { contains: search, mode: "insensitive" };
    if (categoryId) where.categoryId = categoryId;

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          batches: {
            where: status === "ALL" ? {} : { status: status as any },
            select: {
              id: true,
              batchNumber: true,
              quantity: true,
              quantityRemaining: true,
              purchasePrice: true,
              expiryDate: true,
              status: true,
              warehouse: { select: { id: true, name: true } },
            },
          },
          _count: { select: { batches: true } },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    const result = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category.name,
      unitOfMeasure: item.unitOfMeasure,
      totalQuantity: item.batches.reduce((s, b) => s + b.quantityRemaining, 0),
      totalValue: item.batches.reduce((s, b) => s + Number(b.purchasePrice) * b.quantityRemaining, 0),
      batchCount: item.batches.length,
      reorderPoint: item.reorderPoint,
      batches: item.batches,
    }));

    return NextResponse.json({
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      meta: {
        apiVersion: "v1",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("External inventory API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
