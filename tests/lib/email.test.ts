import { describe, it, expect } from "vitest";
import {
  lowStockEmail,
  expiryWarningEmail,
  poStatusEmail,
  requestStatusEmail,
} from "@/lib/email";

describe("lowStockEmail", () => {
  it("generates a valid email object with subject and html", () => {
    const result = lowStockEmail("NPK Fertilizer", 5, "kg", 20, 100);
    expect(result.subject).toContain("Low Stock Alert");
    expect(result.subject).toContain("NPK Fertilizer");
    expect(result.html).toContain("NPK Fertilizer");
    expect(result.html).toContain("5");
    expect(result.html).toContain("kg");
    expect(result.html).toContain("FarmOps");
    expect(result.text).toContain("NPK Fertilizer");
  });

  it("includes reorder quantity when provided", () => {
    const result = lowStockEmail("Seeds", 2, "bags", 10, 50);
    expect(result.html).toContain("50");
  });

  it("works without reorder quantity", () => {
    const result = lowStockEmail("Seeds", 2, "bags", 10);
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
  });
});

describe("expiryWarningEmail", () => {
  it("generates expiry warning for items with days left", () => {
    const result = expiryWarningEmail("BATCH-001", "Fertilizer", 50, "kg", 14);
    expect(result.subject).toContain("Expiring Soon");
    expect(result.subject).toContain("Fertilizer");
    expect(result.html).toContain("14 days");
    expect(result.html).toContain("Fertilizer");
    expect(result.html).toContain("BATCH-001");
  });

  it("generates expired notification for items past expiry", () => {
    const result = expiryWarningEmail("BATCH-002", "Seeds", 20, "bags", 0);
    expect(result.subject).toContain("Expired");
    expect(result.html).toContain("EXPIRED");
  });

  it("uses red theme for critical (≤7 days)", () => {
    const result = expiryWarningEmail("B-003", "Chemical", 10, "liters", 5);
    expect(result.html).toContain("#dc2626");
  });

  it("uses amber theme for medium urgency (8-30 days)", () => {
    const result = expiryWarningEmail("B-004", "Feed", 30, "kg", 20);
    expect(result.html).toContain("#f59e0b");
  });
});

describe("poStatusEmail", () => {
  it("generates PO status email", () => {
    const result = poStatusEmail("PO-2609-0001", "SHIPPED", "Agro Supply Co.", 5000);
    expect(result.subject).toContain("PO-2609-0001");
    expect(result.subject).toContain("SHIPPED");
    expect(result.html).toContain("PO-2609-0001");
    expect(result.html).toContain("Agro Supply Co.");
    expect(result.html).toContain("5,000");
  });
});

describe("requestStatusEmail", () => {
  it("generates approved request email", () => {
    const result = requestStatusEmail(
      "REQ-2609-0001",
      "NPK Fertilizer",
      "APPROVED",
      "Farm Manager",
      "Approved for planting season"
    );
    expect(result.subject).toContain("REQ-2609-0001");
    expect(result.subject).toContain("APPROVED");
    expect(result.html).toContain("approved");
    expect(result.html).toContain("Farm Manager");
    expect(result.html).toContain("Approved for planting season");
  });

  it("generates rejected request email", () => {
    const result = requestStatusEmail(
      "REQ-2609-0002",
      "Seeds",
      "REJECTED",
      "Admin",
      "Budget exceeded"
    );
    expect(result.subject).toContain("REJECTED");
    expect(result.html).toContain("rejected");
    expect(result.html).toContain("Budget exceeded");
  });

  it("generates fulfilled request email", () => {
    const result = requestStatusEmail(
      "REQ-2609-0003",
      "Feed",
      "FULFILLED",
      "Warehouse Manager"
    );
    expect(result.subject).toContain("FULFILLED");
    expect(result.html).toContain("fulfilled");
  });

  it("works without review note", () => {
    const result = requestStatusEmail(
      "REQ-2609-0004",
      "Chemical",
      "APPROVED",
      "Manager"
    );
    expect(result.subject).toBeTruthy();
    expect(result.html).toContain("Chemical");
    // Should not include "Note:" section
    expect(result.html).not.toContain('Note: "');
  });
});
