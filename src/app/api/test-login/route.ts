import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Temporary diagnostic endpoint — remove in production
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, password: true, role: true, isActive: true },
    });

    if (!user) {
      return NextResponse.json({ found: false, error: "User not found" });
    }

    const isValid = await bcrypt.compare(password, user.password);

    return NextResponse.json({
      found: true,
      isActive: user.isActive,
      role: user.role,
      passwordValid: isValid,
      hashPrefix: user.password.substring(0, 10),
      hashLength: user.password.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
