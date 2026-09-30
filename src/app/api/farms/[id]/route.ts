import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard } from "@/lib/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await mutationGuard(request, { minRole: "FARM_MANAGER" });
    if (guard instanceof NextResponse) return guard;
    const { id } = await params;

    // Non-admins may only edit their own farm
    if (guard.role !== "ADMIN" && guard.farmId !== id) {
      return NextResponse.json({ error: "Not authorized to edit this farm" }, { status: 403 });
    }

    const body = await request.json();
    const { name, location, description, acreage } = body;

    const farm = await prisma.farm.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(location !== undefined && { location }),
        ...(description !== undefined && { description }),
        ...(acreage !== undefined && { acreage }),
      },
    });

    return NextResponse.json(farm);
  } catch (error) {
    console.error("Error updating farm:", error);
    return NextResponse.json(
      { error: "Failed to update farm" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await mutationGuard(request, { minRole: "ADMIN" });
    if (guard instanceof NextResponse) return guard;
    const { id } = await params;

    // Check for dependent records
    const farm = await prisma.farm.findUnique({
      where: { id },
      include: { warehouses: true, seasons: true },
    });

    if (!farm) {
      return NextResponse.json({ error: "Farm not found" }, { status: 404 });
    }

    if (farm.warehouses.length > 0 || farm.seasons.length > 0) {
      // Soft delete
      await prisma.farm.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ message: "Farm deactivated" });
    }

    // Hard delete
    await prisma.farm.delete({ where: { id } });
    return NextResponse.json({ message: "Farm deleted" });
  } catch (error) {
    console.error("Error deleting farm:", error);
    return NextResponse.json({ error: "Failed to delete farm" }, { status: 500 });
  }
}
