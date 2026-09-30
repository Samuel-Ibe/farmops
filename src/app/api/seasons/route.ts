import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, requireAuth } from "@/lib/api-auth";

export async function GET() {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
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
    const guard = await mutationGuard(request, { minRole: "FARM_MANAGER" });
    if (guard instanceof NextResponse) return guard;
    const body = await request.json();
    const { name, cropType, farmId, startDate, endDate, status } = body;

    // Non-admins can only create seasons on their own farm
    const scopedFarmId = guard.role === "ADMIN" ? farmId : guard.farmId;
    if (!scopedFarmId) {
      return NextResponse.json({ error: "No farm assigned to your account" }, { status: 400 });
    }

    const season = await prisma.season.create({
      data: {
        name,
        cropType,
        farmId: scopedFarmId,
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
