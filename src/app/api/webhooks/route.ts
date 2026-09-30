import { NextResponse } from "next/server";
import { registerWebhook, listWebhooks, WEBHOOK_EVENTS } from "@/lib/webhooks";
import { mutationGuard, requireAuth } from "@/lib/api-auth";

/**
 * GET /api/webhooks
 * List all registered webhooks
 */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const webhooks = listWebhooks();
    const events = Object.values(WEBHOOK_EVENTS);
    return NextResponse.json({ webhooks, availableEvents: events });
  } catch (error) {
    return NextResponse.json({ error: "Failed to list webhooks" }, { status: 500 });
  }
}

/**
 * POST /api/webhooks
 * Register a new webhook
 * Body: { url: string, events: string[] }
 */
export async function POST(request: Request) {
  try {
    const user = await mutationGuard(request, { minRole: "ADMIN" });
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const { url, events } = body;

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "url and events[] are required" },
        { status: 400 }
      );
    }

    // Validate URL + block SSRF targets (private/loopback/link-local hosts)
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "Only http(s) URLs are allowed" }, { status: 400 });
    }
    const host = parsed.hostname.toLowerCase();
    const isPrivate =
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^fc|^fd|^fe80/i.test(host);
    if (isPrivate) {
      return NextResponse.json(
        { error: "Webhook URLs may not target private or internal hosts" },
        { status: 400 }
      );
    }

    const webhook = registerWebhook(url, events);
    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to register webhook" },
      { status: 500 }
    );
  }
}
