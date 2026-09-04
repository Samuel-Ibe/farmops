import { describe, it, expect, beforeEach } from "vitest";
import {
  registerWebhook,
  unregisterWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  getDeliveryLogs,
  WEBHOOK_EVENTS,
} from "@/lib/webhooks";

describe("Webhook Management", () => {
  let webhookId: string;

  beforeEach(() => {
    // Clean up any previously registered webhooks
    const existing = listWebhooks();
    existing.forEach((wh) => unregisterWebhook(wh.id));
  });

  it("registers a new webhook", () => {
    const wh = registerWebhook("https://example.com/hook", ["inventory.created"]);
    webhookId = wh.id;
    expect(wh.id).toBeTruthy();
    expect(wh.url).toBe("https://example.com/hook");
    expect(wh.events).toEqual(["inventory.created"]);
    expect(wh.isActive).toBe(true);
    expect(wh.secret).toMatch(/^whsec_/);
  });

  it("lists registered webhooks", () => {
    const wh = registerWebhook("https://example.com/hook", ["*"]);
    webhookId = wh.id;
    const list = listWebhooks();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((w) => w.id === wh.id)).toBe(true);
  });

  it("gets a webhook by id", () => {
    const wh = registerWebhook("https://example.com/hook", ["batch.created"]);
    webhookId = wh.id;
    const found = getWebhook(wh.id);
    expect(found).toBeTruthy();
    expect(found?.url).toBe("https://example.com/hook");
  });

  it("updates a webhook", () => {
    const wh = registerWebhook("https://example.com/hook", ["*"]);
    webhookId = wh.id;
    const updated = updateWebhook(wh.id, {
      url: "https://new-url.com/hook",
      events: ["inventory.created", "batch.created"],
    });
    expect(updated?.url).toBe("https://new-url.com/hook");
    expect(updated?.events).toEqual(["inventory.created", "batch.created"]);
  });

  it("toggles webhook active status", () => {
    const wh = registerWebhook("https://example.com/hook", ["*"]);
    webhookId = wh.id;
    updateWebhook(wh.id, { isActive: false });
    const found = getWebhook(wh.id);
    expect(found?.isActive).toBe(false);
  });

  it("unregisters a webhook", () => {
    const wh = registerWebhook("https://example.com/hook", ["*"]);
    const result = unregisterWebhook(wh.id);
    expect(result).toBe(true);
    expect(getWebhook(wh.id)).toBeUndefined();
  });

  it("returns false when unregistering non-existent webhook", () => {
    const result = unregisterWebhook("nonexistent");
    expect(result).toBe(false);
  });

  it("returns undefined for non-existent webhook", () => {
    expect(getWebhook("nonexistent")).toBeUndefined();
  });

  it("returns undefined when updating non-existent webhook", () => {
    const result = updateWebhook("nonexistent", { url: "https://new.com" });
    expect(result).toBeUndefined();
  });
});

describe("WEBHOOK_EVENTS", () => {
  it("contains all expected event types", () => {
    expect(WEBHOOK_EVENTS.INVENTORY_CREATED).toBe("inventory.created");
    expect(WEBHOOK_EVENTS.BATCH_SPLIT).toBe("batch.split");
    expect(WEBHOOK_EVENTS.TRANSACTION_CREATED).toBe("transaction.created");
    expect(WEBHOOK_EVENTS.PO_RECEIVED).toBe("po.received");
    expect(WEBHOOK_EVENTS.LOW_STOCK_ALERT).toBe("alert.low_stock");
    expect(WEBHOOK_EVENTS.EXPIRY_ALERT).toBe("alert.expiry");
  });

  it("has at least 10 events", () => {
    const events = Object.values(WEBHOOK_EVENTS);
    expect(events.length).toBeGreaterThanOrEqual(10);
  });
});

describe("Delivery Logs", () => {
  it("returns delivery logs (may be empty)", () => {
    const logs = getDeliveryLogs();
    expect(Array.isArray(logs)).toBe(true);
  });

  it("filters logs by webhook id", () => {
    const logs = getDeliveryLogs("nonexistent");
    expect(logs).toEqual([]);
  });
});
