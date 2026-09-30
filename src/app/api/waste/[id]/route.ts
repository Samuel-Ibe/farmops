import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mutationGuard, writeAuditLog, getClientIp } from "@/lib/api-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
    if (user instanceof NextResponse) return user;

    const { id } = await params;
    const record = await prisma.wasteRecord.findUnique({ where: { id } });
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Ownership: non-admins may only delete waste records from their own farm
    if (user.role !== "ADMIN" && record.farmId !== user.farmId) {
      return NextResponse.json({ error: "Record belongs to another farm" }, { status: 403 });
    }

    await prisma.wasteRecord.delete({ where: { id } });

    await writeAuditLog({
      userId: user.id,
      action: "DELETE",
      entity: "WasteRecord",
      entityId: id,
      oldValues: { wasteType: record.wasteType, quantity: record.quantity },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ message: "Record deleted" });
  } catch (error) {
    console.error("Error deleting waste record:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
