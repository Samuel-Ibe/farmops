import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const farms = await prisma.farm.findMany({
      where: { isActive: true },
      include: {
        warehouses: {
          where: { isActive: true },
          include: {
            _count: { select: { batches: true } },
          },
        },
        _count: {
          select: { warehouses: true, resourceRequests: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(farms);
  } catch (error) {
    console.error("Error fetching farms:", error);
    return NextResponse.json(
      { error: "Failed to fetch farms" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, location, description, acreage } = body;

    const farm = await prisma.farm.create({
      data: { name, location, description, acreage },
    });

    return NextResponse.json(farm, { status: 201 });
  } catch (error) {
    console.error("Error creating farm:", error);
    return NextResponse.json(
      { error: "Failed to create farm" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, location, description, acreage } = body;

    const farm = await prisma.farm.update({
      where: { id },
      data: { name, location, description, acreage },
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
