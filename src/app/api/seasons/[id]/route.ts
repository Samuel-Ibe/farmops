import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, name, startDate, endDate, cropType } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (name) updateData.name = name;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (cropType !== undefined) updateData.cropType = cropType;

    const season = await prisma.season.update({
      where: { id },
      data: updateData,
      include: { plans: { include: { item: true } }, farm: true },
    });

    return NextResponse.json(season);
  } catch (error) {
    console.error("Error updating season:", error);
    return NextResponse.json({ error: "Failed to update season" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const season = await prisma.season.findUnique({ where: { id } });
    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    // Delete plans first
    await prisma.seasonInventoryPlan.deleteMany({ where: { seasonId: id } });
    await prisma.season.delete({ where: { id } });

    return NextResponse.json({ message: "Season deleted" });
  } catch (error) {
    console.error("Error deleting season:", error);
    return NextResponse.json({ error: "Failed to delete season" }, { status: 500 });
  }
}
