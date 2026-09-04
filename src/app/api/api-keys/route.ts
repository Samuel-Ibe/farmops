import { NextResponse } from "next/server";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys";
import { mutationGuard } from "@/lib/api-auth";

/**
 * GET /api/api-keys
 * List all API keys
 */
export async function GET() {
  const keys = listApiKeys();
  // Mask keys for display
  const masked = keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPreview: k.key.slice(0, 12) + "..." + k.key.slice(-4),
    permissions: k.permissions,
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
    const { name, permissions } = body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: "name and permissions[] are required" },
        { status: 400 }
      );
    }

    const apiKey = createApiKey(name, permissions);
    // Return the full key only on creation
    return NextResponse.json(apiKey, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
