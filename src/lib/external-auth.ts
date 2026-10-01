import { NextResponse } from "next/server";
import { hasPermission, validateApiKey, type ApiKey } from "@/lib/api-keys";

/**
 * Authenticate an external API request via `Authorization: Bearer <key>` and
 * enforce the route's explicit permission scope. Key secrets are validated
 * against their stored SHA-256 digest — never a usable secret at rest.
 */
export async function authenticateExternal(
  request: Request,
  requiredScope: string
): Promise<ApiKey | NextResponse> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header. Use: Bearer <api_key>" },
      { status: 401 }
    );
  }
  const apiKey = validateApiKey(authHeader.slice(7));
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }
  if (!hasPermission(apiKey, requiredScope)) {
    return NextResponse.json(
      { error: "API key lacks required scope", required: requiredScope },
      { status: 403 }
    );
  }
  return apiKey;
}
