import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp } from "@/lib/api-auth";
import { validate, createWasteSchema } from "@/lib/api-validations";
import { parsePaginationParams, cachedJsonResponse } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(searchParams, { limit: 20 });

    const [records, total] = await Promise.all([
      prisma.wasteRecord.findMany({
        include: {
          batch: { include: { item: true, warehouse: true } },
          reportedBy: { select: { name: true, role: true } },
          farm: true,
        },
        orderBy: { reportedAt: "desc" },
        skip: pagination.offset,
        take: pagination.limit,
      }),
      prisma.wasteRecord.count(),
    ]);

    return cachedJsonResponse(records, 30);
  } catch (error) {
    console.error("Error fetching waste records:", error);
    return NextResponse.json({ error: "Failed to fetch waste records" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const validation = validate(createWasteSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, details: validation.details }, { status: 400 });
    }

    const { batchId, farmId, wasteType, quantity, estimatedValue, reason } = validation.data;

    const record = await prisma.wasteRecord.create({
      data: {
        batchId, farmId, reportedById: user.id, wasteType, quantity,
        estimatedValue: estimatedValue || undefined,
        reason: reason || undefined,
      },
      include: { batch: { include: { item: true } } },
    });

    await writeAuditLog({ userId: user.id, action: "CREATE", entity: "WasteRecord", entityId: record.id, newValues: { wasteType, quantity }, ipAddress: getClientIp(request) });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Error creating waste record:", error);
    return NextResponse.json({ error: "Failed to create waste record" }, { status: 500 });
  }
}
