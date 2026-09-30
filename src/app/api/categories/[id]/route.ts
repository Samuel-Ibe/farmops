import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard } from "@/lib/api-auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await mutationGuard(request, { minRole: "FARM_MANAGER" });
    if (guard instanceof NextResponse) return guard;
    const { id } = await params;
    const body = await request.json();
    const { name, color, description, icon } = body;

    const category = await prisma.category.update({
      where: { id },
      data: { name, color, description, icon },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
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

    // Check if category has items
    const itemCount = await prisma.inventoryItem.count({
      where: { categoryId: id, isActive: true },
    });

    if (itemCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${itemCount} active items. Move items first or rename the category.` },
        { status: 400 }
      );
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ message: "Category deleted" });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
