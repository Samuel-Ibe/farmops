import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity");
    const entityId = searchParams.get("entityId");
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(entity && { entity }),
        ...(entityId && { entityId }),
        ...(userId && { userId }),
      },
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
