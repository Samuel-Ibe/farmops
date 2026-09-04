import { NextResponse } from "next/server";
import { getWebhook, updateWebhook, unregisterWebhook, getDeliveryLogs, triggerWebhooks } from "@/lib/webhooks";
import { mutationGuard } from "@/lib/api-auth";

/**
 * GET /api/webhooks/:id
 * Get webhook details and delivery logs
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const webhook = getWebhook(id);
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const logs = getDeliveryLogs(id);
    return NextResponse.json({ webhook, logs: logs.slice(-20) });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch webhook" }, { status: 500 });
  }
}

/**
 * PATCH /api/webhooks/:id
 * Update webhook (url, events, isActive)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await mutationGuard(request, { minRole: "ADMIN" });
    if (user instanceof NextResponse) return user;

    const { id } = await params;
    const body = await request.json();
    const webhook = updateWebhook(id, body);

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json(webhook);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

/**
 * DELETE /api/webhooks/:id
 * Remove a webhook
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await mutationGuard(request, { minRole: "ADMIN" });
    if (user instanceof NextResponse) return user;

    const { id } = await params;
    const deleted = unregisterWebhook(id);

    if (!deleted) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Webhook removed" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
