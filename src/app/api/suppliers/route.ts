import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, requireAuth } from "@/lib/api-auth";

export async function GET() {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { batches: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(suppliers);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await mutationGuard(request, { minRole: "FARM_MANAGER" });
    if (guard instanceof NextResponse) return guard;
    const body = await request.json();
    const { name, contactPerson, phone, email, address, rating } = body;

    const supplier = await prisma.supplier.create({
      data: { name, contactPerson, phone, email, address, rating },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("Error creating supplier:", error);
    return NextResponse.json(
      { error: "Failed to create supplier" },
      { status: 500 }
    );
  }
}
