import { NextResponse } from "next/server";
import { registerWebhook, listWebhooks, WEBHOOK_EVENTS } from "@/lib/webhooks";
import { mutationGuard } from "@/lib/api-auth";

/**
 * GET /api/webhooks
 * List all registered webhooks
 */
export async function GET() {
  try {
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

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
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
