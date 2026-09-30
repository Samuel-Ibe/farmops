import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, requireAuth } from "@/lib/api-auth";

export async function GET() {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await mutationGuard(request, { minRole: "FARM_MANAGER" });
    if (guard instanceof NextResponse) return guard;
    const body = await request.json();
    const { name, color, description, icon } = body;

    const category = await prisma.category.create({
      data: { name, color, description, icon },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
