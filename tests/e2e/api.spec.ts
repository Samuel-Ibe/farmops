import { test, expect } from "@playwright/test";

test.describe("API Endpoints", () => {
  test("GET /api/inventory returns items", async ({ request }) => {
    const response = await request.get("/api/inventory");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    // Response should have data or be an array
    expect(data).toBeTruthy();
  });

  test("GET /api/warehouses returns warehouses", async ({ request }) => {
    const response = await request.get("/api/warehouses");
    expect(response.ok()).toBeTruthy();
  });

  test("GET /api/categories returns categories", async ({ request }) => {
    const response = await request.get("/api/categories");
    expect(response.ok()).toBeTruthy();
  });

  test("GET /api/suppliers returns suppliers", async ({ request }) => {
    const response = await request.get("/api/suppliers");
    expect(response.ok()).toBeTruthy();
  });

  test("GET /api/farms returns farms", async ({ request }) => {
    const response = await request.get("/api/farms");
    expect(response.ok()).toBeTruthy();
  });

  test("GET /api/alerts returns alerts with summary", async ({ request }) => {
    const response = await request.get("/api/alerts?type=all");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("alerts");
    expect(data).toHaveProperty("summary");
    expect(data.summary).toHaveProperty("totalAlerts");
  });

  test("GET /api/reports?type=dashboard returns dashboard data", async ({ request }) => {
    const response = await request.get("/api/reports?type=dashboard");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toBeTruthy();
  });

  test("GET /api/intelligence returns analysis data", async ({ request }) => {
    const response = await request.get("/api/intelligence");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toBeTruthy();
  });

  test("POST /api/batches/split returns 405 for GET", async ({ request }) => {
    const response = await request.get("/api/batches/split");
    expect(response.status()).toBe(405);
  });

  test("POST /api/batches/transfer returns 405 for GET", async ({ request }) => {
    const response = await request.get("/api/batches/transfer");
    expect(response.status()).toBe(405);
  });

  test("GET /api/webhooks returns webhook list", async ({ request }) => {
    const response = await request.get("/api/webhooks");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("webhooks");
    expect(data).toHaveProperty("availableEvents");
  });

  test("GET /api/api-keys returns API key list", async ({ request }) => {
    const response = await request.get("/api/api-keys");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("apiKeys");
  });

  test("External API requires auth header", async ({ request }) => {
    const response = await request.get("/api/external/inventory");
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  test("GET /api/export/excel returns Excel file", async ({ request }) => {
    const response = await request.get("/api/export/excel?type=inventory");
    expect(response.ok()).toBeTruthy();
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("spreadsheetml");
  });

  test("GET /api/export/pdf returns PDF file", async ({ request }) => {
    const response = await request.get("/api/export/pdf?type=summary");
    expect(response.ok()).toBeTruthy();
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("pdf");
  });

  test("POST without CSRF origin is rejected on protected routes", async ({ request }) => {
    const response = await request.post("/api/transactions", {
      headers: { "Content-Type": "application/json" },
      data: { type: "RECEIVED", batchId: "test", quantity: 1 },
    });
    // Should be CSRF blocked (403) or auth blocked (401/403)
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
