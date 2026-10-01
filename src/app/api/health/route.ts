import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const processStartedAt = Date.now();

/**
 * GET /api/health — liveness/readiness probe for deployment checks.
 *
 * Returns 200 when the database answers (ready) and 503 when it does not, so
 * a load balancer or orchestrator can route traffic away from an instance
 * that cannot serve reads/writes. Deliberately reveals no configuration.
 */
export async function GET() {
  const checks: Record<string, { status: "up" | "down"; latencyMs?: number }> = {};
  let ready = true;

  const dbStart = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "up", latencyMs: Math.round(performance.now() - dbStart) };
  } catch (error) {
    ready = false;
    checks.database = { status: "down" };
    logger.error("Health check failed: database unreachable", { error });
  }

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round((Date.now() - processStartedAt) / 1000),
      checks,
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
