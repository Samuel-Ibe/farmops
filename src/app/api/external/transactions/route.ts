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
 * GET /api/external/transactions
 * External API: Get stock transactions with filtering.
 * Requires API key in Authorization: Bearer <key>
 *
 * Query params: type, batchId, farmId, startDate, endDate, page, limit
 */
export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const batchId = searchParams.get("batchId");
    const farmId = searchParams.get("farmId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (batchId) where.batchId = batchId;
    if (farmId) where.farmId = farmId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.stockTransaction.findMany({
        where,
        include: {
          batch: { select: { batchNumber: true, item: { select: { name: true, unitOfMeasure: true } } } },
          fromWarehouse: { select: { id: true, name: true } },
          toWarehouse: { select: { id: true, name: true } },
          performedBy: { select: { id: true, name: true } },
          farm: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockTransaction.count({ where }),
    ]);

    return NextResponse.json({
      data: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        item: t.batch.item.name,
        unitOfMeasure: t.batch.item.unitOfMeasure,
        batchNumber: t.batch.batchNumber,
        quantity: t.quantity,
        unitCost: Number(t.unitCost || 0),
        totalValue: Number(t.totalValue || 0),
        fromWarehouse: t.fromWarehouse?.name || null,
        toWarehouse: t.toWarehouse?.name || null,
        performedBy: t.performedBy.name,
        farm: t.farm?.name || null,
        reason: t.reason,
        referenceNumber: t.referenceNumber,
        createdAt: t.createdAt.toISOString(),
      })),
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
    console.error("External transactions API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
