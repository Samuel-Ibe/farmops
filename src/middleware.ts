import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/inventory",
  "/warehouses",
  "/transactions",
  "/requests",
  "/farms",
  "/suppliers",
  "/purchase-orders",
  "/waste",
  "/stock-count",
  "/seasons",
  "/reports",
  "/audit-log",
  "/notifications",
  "/intelligence",
  "/alerts",
  "/settings",
];

// Routes that are public (no auth required)
const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/api/auth", "/api/seed"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isProtected) {
    // Check for session token (simple check — real auth check happens in components)
    const sessionToken =
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-authjs.session-token")?.value ||
      request.cookies.get("next-auth.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value;

    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
