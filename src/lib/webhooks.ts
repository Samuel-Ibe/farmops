import { prisma } from "@/lib/prisma";

export interface WebhookPayload {
  event: string;
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ─── Webhook Event Types ───────────────────────────────
export const WEBHOOK_EVENTS = {
  INVENTORY_CREATED: "inventory.created",
  INVENTORY_UPDATED: "inventory.updated",
  BATCH_CREATED: "batch.created",
  BATCH_SPLIT: "batch.split",
  TRANSACTION_CREATED: "transaction.created",
  STOCK_TRANSFER: "stock.transfer",
  PO_CREATED: "po.created",
  PO_STATUS_CHANGED: "po.status_changed",
  PO_RECEIVED: "po.received",
  REQUEST_CREATED: "request.created",
  REQUEST_STATUS_CHANGED: "request.status_changed",
  WASTE_RECORDED: "waste.recorded",
  LOW_STOCK_ALERT: "alert.low_stock",
  EXPIRY_ALERT: "alert.expiry",
  USER_CREATED: "user.created",
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

interface RegisteredWebhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
}

// ─── In-memory webhook registry (persists via DB) ──────
// For a real app, this would be a WebhookConfig model in Prisma.
// For now, we use a simple in-memory store + file-based fallback.

const webhookStore = new Map<string, RegisteredWebhook>();

export function registerWebhook(url: string, events: string[], secret?: string): RegisteredWebhook {
  const id = `wh_${Date.now().toString(36)}`;
  const webhook: RegisteredWebhook = {
    id,
    url,
    events,
    secret: secret || generateSecret(),
    isActive: true,
  };
  webhookStore.set(id, webhook);
  return webhook;
}

export function unregisterWebhook(id: string): boolean {
  return webhookStore.delete(id);
}

export function listWebhooks(): RegisteredWebhook[] {
  return Array.from(webhookStore.values());
}

export function getWebhook(id: string): RegisteredWebhook | undefined {
  return webhookStore.get(id);
}

export function updateWebhook(id: string, updates: Partial<Pick<RegisteredWebhook, "url" | "events" | "isActive">>): RegisteredWebhook | undefined {
  const wh = webhookStore.get(id);
  if (!wh) return undefined;
  if (updates.url !== undefined) wh.url = updates.url;
  if (updates.events !== undefined) wh.events = updates.events;
  if (updates.isActive !== undefined) wh.isActive = updates.isActive;
  return wh;
}

function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "whsec_";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// ─── Webhook Delivery ──────────────────────────────────

export interface DeliveryLog {
  webhookId: string;
  event: string;
  url: string;
  statusCode: number;
  success: boolean;
  error?: string;
  timestamp: string;
  durationMs: number;
}

const deliveryLogs: DeliveryLog[] = [];

export async function triggerWebhooks(
  event: WebhookEvent,
  entity: string,
  entityId: string,
  data: Record<string, unknown>
): Promise<DeliveryLog[]> {
  const payload: WebhookPayload = {
    event,
    entity,
    entityId,
    data,
    timestamp: new Date().toISOString(),
  };

  const matchingWebhooks = Array.from(webhookStore.values()).filter(
    (wh) => wh.isActive && (wh.events.includes("*") || wh.events.includes(event))
  );

  if (matchingWebhooks.length === 0) return [];

  const results = await Promise.allSettled(
    matchingWebhooks.map((wh) => deliverWebhook(wh, payload))
  );

  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean) as DeliveryLog[];
}

async function deliverWebhook(
  webhook: RegisteredWebhook,
  payload: WebhookPayload
): Promise<DeliveryLog> {
  const start = Date.now();
  const body = JSON.stringify(payload);

  // Create HMAC signature if secret is set
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": payload.event,
    "X-Webhook-ID": webhook.id,
    "User-Agent": "FarmOps-Webhook/1.0",
  };

  if (webhook.secret) {
    const { createHmac } = await import("crypto");
    const signature = createHmac("sha256", webhook.secret)
      .update(body)
      .digest("hex");
    headers["X-Webhook-Signature"] = `sha256=${signature}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const log: DeliveryLog = {
      webhookId: webhook.id,
      event: payload.event,
      url: webhook.url,
      statusCode: response.status,
      success: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };

    deliveryLogs.push(log);
    if (deliveryLogs.length > 100) deliveryLogs.shift();

    return log;
  } catch (error) {
    const log: DeliveryLog = {
      webhookId: webhook.id,
      event: payload.event,
      url: webhook.url,
      statusCode: 0,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    };

    deliveryLogs.push(log);
    if (deliveryLogs.length > 100) deliveryLogs.shift();

    return log;
  }
}

export function getDeliveryLogs(webhookId?: string): DeliveryLog[] {
  if (webhookId) {
    return deliveryLogs.filter((log) => log.webhookId === webhookId);
  }
  return [...deliveryLogs];
}
