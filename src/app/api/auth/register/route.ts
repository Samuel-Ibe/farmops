import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validate, createUserSchema } from "@/lib/api-validations";
import { checkRateLimit, rateLimitResponse, getClientIp, writeAuditLog } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    // Rate limit: 5 registration attempts per IP per 15 minutes
    const ip = getClientIp(request);
    const { allowed, resetAt } = checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return rateLimitResponse(resetAt);
    }

    const body = await request.json();

    const validation = validate(createUserSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { name, email, password, role } = validation.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "FIELD_WORKER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      newValues: { name, email, role: user.role },
      ipAddress: ip,
    });

    return NextResponse.json(
      { message: "Account created successfully", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
