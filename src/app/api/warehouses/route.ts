import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, requireAuth, resolveFarmScope } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const farmId = resolveFarmScope(user, searchParams.get("farmId"));

    const warehouses = await prisma.warehouse.findMany({
      where: {
        isActive: true,
        ...(farmId && { farmId }),
      },
      include: {
        farm: true,
        _count: { select: { batches: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(warehouses);
  } catch (error) {
    console.error("Error fetching warehouses:", error);
    return NextResponse.json(
      { error: "Failed to fetch warehouses" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await mutationGuard(request, { minRole: "FARM_MANAGER" });
    if (guard instanceof NextResponse) return guard;
    const body = await request.json();
    const { name, farmId, location, type, capacity } = body;

    // Non-admins can only create warehouses inside their own farm
    const effectiveFarmId = guard.role === "ADMIN" ? farmId : guard.farmId;
    if (!effectiveFarmId) {
      return NextResponse.json({ error: "No farm assigned to your account" }, { status: 400 });
    }

    const warehouse = await prisma.warehouse.create({
      data: { name, farmId: effectiveFarmId, location, type: type || "PHYSICAL", capacity },
      include: { farm: true },
    });

    return NextResponse.json(warehouse, { status: 201 });
  } catch (error) {
    console.error("Error creating warehouse:", error);
    return NextResponse.json(
      { error: "Failed to create warehouse" },
      { status: 500 }
    );
  }
}
