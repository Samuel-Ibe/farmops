import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const farmId = searchParams.get("farmId");

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
    const body = await request.json();
    const { name, farmId, location, type, capacity } = body;

    const warehouse = await prisma.warehouse.create({
      data: { name, farmId, location, type: type || "PHYSICAL", capacity },
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
