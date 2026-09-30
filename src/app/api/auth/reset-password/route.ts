import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/api-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Matches how the token is stored by /api/auth/forgot-password
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const { allowed, resetAt } = checkRateLimit(`reset-pw:${ip}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return rateLimitResponse(resetAt);
    }

    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json({ error: "Password must contain an uppercase letter" }, { status: 400 });
    }
    if (!/[a-z]/.test(password)) {
      return NextResponse.json({ error: "Password must contain a lowercase letter" }, { status: 400 });
    }
    if (!/[0-9]/.test(password)) {
      return NextResponse.json({ error: "Password must contain a number" }, { status: 400 });
    }

    // Find the notification storing the digest of this token
    const notification = await prisma.notification.findFirst({
      where: {
        type: "STOCK_ADJUSTED",
        message: `RESET_TOKEN:${hashToken(token)}`,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!notification) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

    // Check if token is expired (1 hour)
    const tokenAge = Date.now() - new Date(notification.createdAt).getTime();
    if (tokenAge > 60 * 60 * 1000) {
      return NextResponse.json({ error: "Reset token has expired. Please request a new one." }, { status: 400 });
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: notification.userId },
      data: { password: hashedPassword },
    });

    // Single-use: drop every outstanding reset token for this account
    await prisma.notification.deleteMany({
      where: { userId: notification.userId, message: { startsWith: "RESET_TOKEN:" } },
    });

    return NextResponse.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
