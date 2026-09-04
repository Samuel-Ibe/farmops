import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const seasons = await prisma.season.findMany({
      include: {
        farm: true,
        plans: {
          include: { item: true },
        },
      },
      orderBy: { startDate: "desc" },
    });
    return NextResponse.json(seasons);
  } catch (error) {
    console.error("Error fetching seasons:", error);
    return NextResponse.json(
      { error: "Failed to fetch seasons" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, cropType, farmId, startDate, endDate, status } = body;

    const season = await prisma.season.create({
      data: {
        name,
        cropType,
        farmId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || "PLANNING",
      },
      include: { farm: true },
    });

    return NextResponse.json(season, { status: 201 });
  } catch (error) {
    console.error("Error creating season:", error);
    return NextResponse.json(
      { error: "Failed to create season" },
      { status: 500 }
    );
  }
}
