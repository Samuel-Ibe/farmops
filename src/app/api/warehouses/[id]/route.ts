import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, farmId, location, type, capacity } = body;

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(farmId && { farmId }),
        ...(location !== undefined && { location }),
        ...(type && { type }),
        ...(capacity !== undefined && { capacity }),
      },
      include: { farm: true },
    });

    return NextResponse.json(warehouse);
  } catch (error) {
    console.error("Error updating warehouse:", error);
    return NextResponse.json(
      { error: "Failed to update warehouse" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: { batches: true },
    });

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    if (warehouse.batches.length > 0) {
      await prisma.warehouse.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ message: "Warehouse deactivated" });
    }

    await prisma.warehouse.delete({ where: { id } });
    return NextResponse.json({ message: "Warehouse deleted" });
  } catch (error) {
    console.error("Error deleting warehouse:", error);
    return NextResponse.json({ error: "Failed to delete warehouse" }, { status: 500 });
  }
}
