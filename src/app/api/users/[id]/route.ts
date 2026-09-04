import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, writeAuditLog, getClientIp } from "@/lib/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only admins can update users
    const admin = await requireRole(["ADMIN"]);
    if (admin instanceof NextResponse) return admin;

    const { id } = await params;
    const body = await request.json();

    // Prevent admins from demoting themselves
    if (id === admin.id && body.role && body.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admins cannot demote themselves" },
        { status: 400 }
      );
    }

    // Fetch old values for audit log
    const oldUser = await prisma.user.findUnique({ where: { id }, select: { name: true, role: true, isActive: true } });
    if (!oldUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.role && { role: body.role }),
        ...(body.name && { name: body.name }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    await writeAuditLog({
      userId: admin.id,
      action: "UPDATE",
      entity: "User",
      entityId: id,
      oldValues: { name: oldUser.name, role: oldUser.role, isActive: oldUser.isActive },
      newValues: { name: user.name, role: user.role, isActive: user.isActive },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only admins can update users
    const admin = await requireRole(["ADMIN"]);
    if (admin instanceof NextResponse) return admin;

    const { id } = await params;
    const body = await request.json();
    const { name, role } = body;

    // Only admins can change roles
    if (role && admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can change user roles" },
        { status: 403 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: { name, role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
