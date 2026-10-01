import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildSecurityHeaders } from "@/lib/security-headers";
import { newRequestId } from "@/lib/logger";

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

  // Correlation ID: reused when the client supplies one, generated otherwise.
  const requestId = request.headers.get("x-request-id") || newRequestId();

  const isHttps =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";
  const securityHeaders = buildSecurityHeaders({
    isHttps,
    isDev: process.env.NODE_ENV !== "production",
  });

  let response: NextResponse;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    response = NextResponse.next();
  } else {
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
        response = NextResponse.redirect(loginUrl);
      } else {
        response = NextResponse.next();
      }
    } else {
      response = NextResponse.next();
    }
  }

  // Production security headers on every response (pages and APIs alike)
  for (const [header, value] of Object.entries(securityHeaders)) {
    response.headers.set(header, value);
  }
  response.headers.set("x-request-id", requestId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
