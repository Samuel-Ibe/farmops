import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import {
  checkRateLimit,
  clearLoginFailures,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/rate-limit";

/** Best-effort client IP for login throttling (never trusted for authz). */
async function requestIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Extract email and password directly — Zod schema can be strict with extra fields
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password || typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const ip = await requestIp();
        const normalizedEmail = email.toLowerCase().trim();
        // Failure counters are keyed by IP + account: an attacker cannot
        // exhaust a victim's allowance from another network (no lockout DoS),
        // while brute force from one origin is slowed to 5 attempts / 15 min.
        const failKey = `${ip}:${normalizedEmail}`;

        // Per-IP attempt budget (all attempts, generous: 30/min)
        const ipBudget = checkRateLimit(`login:ip:${ip}`, 30, 60_000);
        if (!ipBudget.allowed || isLoginThrottled(failKey)) {
          // Deliberately indistinguishable from bad credentials
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        // Deliberately non-specific: never reveal whether an account exists
        if (!user || !user.isActive) {
          recordLoginFailure(failKey);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          recordLoginFailure(failKey);
          return null;
        }

        clearLoginFailures(failKey);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          farmId: user.farmId || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
        token.farmId = (user as any).farmId || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).farmId = token.farmId || null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
});
