import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse, getClientIp } from "@/lib/api-auth";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const { allowed, resetAt } = checkRateLimit(`forgot-pw:${ip}`, 3, 15 * 60 * 1000);
    if (!allowed) {
      return rateLimitResponse(resetAt);
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (user) {
      // Generate a secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store as a notification with the token in message (simple approach)
      // In production, use a dedicated PasswordReset table
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Password Reset",
          message: `RESET_TOKEN:${token}`,
          type: "STOCK_ADJUSTED",
        },
      });

      // In a real app, send email here
      console.log(`[Password Reset] Token for ${email}: ${token}`);
      console.log(`[Password Reset] Reset URL: ${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/reset-password?token=${token}`);
    }

    return NextResponse.json({
      message: "If an account exists with that email, you'll receive a reset link shortly.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
