import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp, requireAuth, resolveFarmScope } from "@/lib/api-auth";
import { validate, createRequestSchema } from "@/lib/api-validations";
import { parsePaginationParams, paginatedResponse, cachedJsonResponse } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const farmId = resolveFarmScope(user, searchParams.get("farmId"));
    const pagination = parsePaginationParams(searchParams, { limit: 20 });

    const where = {
      ...(status && { status: status as any }),
      ...(farmId && { farmId }),
    };

    const [requests, total] = await Promise.all([
      prisma.resourceRequest.findMany({
        where,
        include: {
          item: true, farm: true,
          requestedBy: { select: { name: true, role: true } },
          reviewedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.offset,
        take: pagination.limit,
      }),
      prisma.resourceRequest.count({ where }),
    ]);

    return cachedJsonResponse(requests, 15);
  } catch (error) {
    console.error("Error fetching requests:", error);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await mutationGuard(request);
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const validation = validate(createRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, details: validation.details }, { status: 400 });
    }

    const { farmId, warehouseId, itemId, quantity, unitOfMeasure, purpose, priority } = validation.data;

    // Non-admin requests are always stamped with the caller's own farm
    const scopedFarmId = user.role === "ADMIN" ? farmId : user.farmId;
    if (!scopedFarmId) {
      return NextResponse.json({ error: "No farm assigned to your account" }, { status: 400 });
    }

    const count = await prisma.resourceRequest.count();
    const now = new Date();
    const requestNumber = `REQ-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, "0")}-${(count + 1).toString().padStart(4, "0")}`;

    const resourceRequest = await prisma.resourceRequest.create({
      data: {
        requestNumber, requestedById: user.id, farmId: scopedFarmId,
        warehouseId: warehouseId || undefined,
        itemId, quantity, unitOfMeasure,
        purpose: purpose || undefined, priority,
      },
      include: { item: true, farm: true, requestedBy: { select: { name: true, role: true } } },
    });

    await writeAuditLog({ userId: user.id, action: "CREATE", entity: "ResourceRequest", entityId: resourceRequest.id, newValues: { requestNumber, itemId, quantity }, ipAddress: getClientIp(request) });

    return NextResponse.json(resourceRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating request:", error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
