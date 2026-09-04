import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[Auth] authorize called with:", JSON.stringify(Object.keys(credentials || {})));
        // Extract email and password directly — Zod schema can be strict with extra fields
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        console.log("[Auth] email:", email, "password present:", !!password, "password type:", typeof password);

        if (!email || !password || typeof email !== "string" || typeof password !== "string") {
          console.log("[Auth] Missing email or password");
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });

        if (!user) {
          console.log("[Auth] User not found:", email);
          return null;
        }

        if (!user.isActive) {
          console.log("[Auth] User inactive:", email);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          console.log("[Auth] Invalid password for:", email);
          return null;
        }

        console.log("[Auth] Login successful:", email, user.role);
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
