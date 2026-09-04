import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp } from "@/lib/api-auth";
import { validate, createPurchaseOrderSchema } from "@/lib/api-validations";
import { parsePaginationParams, cachedJsonResponse } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(searchParams, { limit: 20 });

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        include: {
          supplier: true, farm: true,
          items: { include: { item: true } },
          createdBy: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.offset,
        take: pagination.limit,
      }),
      prisma.purchaseOrder.count(),
    ]);

    return cachedJsonResponse(orders, 30);
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    return NextResponse.json({ error: "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await mutationGuard(request, { minRole: "FARM_MANAGER" });
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const validation = validate(createPurchaseOrderSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, details: validation.details }, { status: 400 });
    }

    const { supplierId, farmId, items, expectedDeliveryDate, notes } = validation.data;
    const count = await prisma.purchaseOrder.count();
    const now = new Date();
    const orderNumber = `PO-${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, "0")}-${(count + 1).toString().padStart(4, "0")}`;
    const totalAmount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber, supplierId, farmId, createdById: user.id, totalAmount,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        notes: notes || undefined,
        items: { create: items.map((item: any) => ({ itemId: item.itemId, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.quantity * item.unitPrice })) },
      },
      include: { supplier: true, items: { include: { item: true } } },
    });

    await writeAuditLog({ userId: user.id, action: "CREATE", entity: "PurchaseOrder", entityId: order.id, newValues: { orderNumber, totalAmount }, ipAddress: getClientIp(request) });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 });
  }
}
