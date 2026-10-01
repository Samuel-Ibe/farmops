import { NextResponse } from "next/server";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys";
import { mutationGuard, requireRole } from "@/lib/api-auth";

/**
 * GET /api/api-keys
 * List all API keys (admin only — reveals key metadata)
 */
export async function GET() {
  const user = await requireRole(["ADMIN"]);
  if (user instanceof NextResponse) return user;
  const keys = listApiKeys();
  // Keys are stored hashed — `k.key` is already a non-reversible display hint
  const masked = keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPreview: k.key,
    permissions: k.permissions,
    farmId: k.farmId ?? null,
    isActive: k.isActive,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    usageCount: k.usageCount,
  }));
  return NextResponse.json({ apiKeys: masked });
}

/**
 * POST /api/api-keys
 * Create a new API key
 * Body: { name: string, permissions: string[] }
 */
export async function POST(request: Request) {
  try {
    const user = await mutationGuard(request, { minRole: "ADMIN" });
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const { name, permissions, farmId } = body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: "name and permissions[] are required" },
        { status: 400 }
      );
    }

    // Optionally pin the key to a single farm for tenant isolation
    if (farmId) {
      const { prisma } = await import("@/lib/prisma");
      const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true } });
      if (!farm) {
        return NextResponse.json({ error: "Unknown farmId" }, { status: 400 });
      }
    }

    const apiKey = createApiKey(name, permissions, farmId || null);
    // Return the full key only on creation
    return NextResponse.json(apiKey, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
