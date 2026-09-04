import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  daysUntilExpiry,
  isExpired,
  isExpiringSoon,
  generateBatchNumber,
  generateRequestNumber,
  generateOrderNumber,
  getStockStatusColor,
  getExpiryStatusColor,
} from "@/lib/utils";

describe("cn (className merger)", () => {
  it("merges conflicting tailwind classes", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("handles conditional classes", () => {
    const result = cn("base", true && "active", false && "hidden");
    expect(result).toContain("base");
    expect(result).toContain("active");
    expect(result).not.toContain("hidden");
  });

  it("handles undefined and null gracefully", () => {
    const result = cn("base", undefined, null);
    expect(result).toBe("base");
  });

  it("returns empty string for no input", () => {
    expect(cn()).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats a positive number with GH₵ prefix", () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain("GH₵");
    expect(result).toContain("1,234.56");
  });

  it("formats zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("GH₵");
    expect(result).toContain("0.00");
  });

  it("formats negative values", () => {
    const result = formatCurrency(-500);
    expect(result).toContain("GH₵");
    expect(result).toContain("-500");
  });

  it("handles custom currency", () => {
    const result = formatCurrency(100, "USD");
    expect(result).toContain("USD");
    expect(result).not.toContain("GH₵");
  });
});

describe("formatDate", () => {
  it("formats a valid date string", () => {
    const result = formatDate("2026-01-15");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date("2026-06-15"));
    expect(result).toBeTruthy();
  });
});

describe("formatDateTime", () => {
  it("includes both date and time", () => {
    const result = formatDateTime("2026-03-15T14:30:00Z");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});

describe("formatRelativeTime", () => {
  it("returns a relative time string", () => {
    const recent = new Date();
    recent.setMinutes(recent.getMinutes() - 5);
    const result = formatRelativeTime(recent);
    expect(result).toBeTruthy();
    expect(result).toContain("ago");
  });
});

describe("daysUntilExpiry", () => {
  it("returns positive number for future dates", () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const result = daysUntilExpiry(future.toISOString());
    expect(result).toBeGreaterThanOrEqual(29);
    expect(result).toBeLessThanOrEqual(31);
  });

  it("returns negative number for past dates", () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const result = daysUntilExpiry(past.toISOString());
    expect(result).toBeLessThan(0);
  });

  it("returns 0 for today", () => {
    const today = new Date().toISOString();
    const result = daysUntilExpiry(today);
    expect(result).toBe(0);
  });
});

describe("isExpired", () => {
  it("returns true for past dates", () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);
    expect(isExpired(past.toISOString())).toBe(true);
  });

  it("returns false for future dates", () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    expect(isExpired(future.toISOString())).toBe(false);
  });
});

describe("isExpiringSoon", () => {
  it("returns true for dates within 30 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 15);
    expect(isExpiringSoon(soon.toISOString())).toBe(true);
  });

  it("returns false for dates beyond 30 days", () => {
    const far = new Date();
    far.setDate(far.getDate() + 60);
    expect(isExpiringSoon(far.toISOString())).toBe(false);
  });

  it("returns false for past dates that already expired", () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(isExpiringSoon(past.toISOString())).toBe(false);
  });

  it("respects custom days parameter", () => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    expect(isExpiringSoon(date.toISOString(), 7)).toBe(false);
    expect(isExpiringSoon(date.toISOString(), 20)).toBe(true);
  });
});

describe("generateBatchNumber", () => {
  it("generates a batch number with default prefix", () => {
    const result = generateBatchNumber();
    expect(result).toMatch(/^BATCH-\d{4}-\d{4}$/);
  });

  it("generates with custom prefix", () => {
    const result = generateBatchNumber("FERT");
    expect(result).toMatch(/^FERT-\d{4}-\d{4}$/);
  });

  it("generates unique values", () => {
    const results = new Set(
      Array.from({ length: 10 }, () => generateBatchNumber())
    );
    expect(results.size).toBe(10);
  });
});

describe("generateRequestNumber", () => {
  it("generates REQ-XXXX-XXXX format", () => {
    const result = generateRequestNumber();
    expect(result).toMatch(/^REQ-\d{4}-\d{4}$/);
  });

  it("generates unique values", () => {
    const results = new Set(
      Array.from({ length: 10 }, () => generateRequestNumber())
    );
    expect(results.size).toBe(10);
  });
});

describe("generateOrderNumber", () => {
  it("generates PO-XXXX-XXXX format", () => {
    const result = generateOrderNumber();
    expect(result).toMatch(/^PO-\d{4}-\d{4}$/);
  });
});

describe("getStockStatusColor", () => {
  it("returns red for zero stock", () => {
    expect(getStockStatusColor(0, 10)).toBe("text-red-600");
  });

  it("returns red for critically low stock", () => {
    expect(getStockStatusColor(3, 10)).toBe("text-red-500");
  });

  it("returns amber for low stock", () => {
    expect(getStockStatusColor(8, 10)).toBe("text-amber-500");
  });

  it("returns green for adequate stock", () => {
    expect(getStockStatusColor(20, 10)).toBe("text-green-600");
  });
});

describe("getExpiryStatusColor", () => {
  it("returns red for expired items", () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(getExpiryStatusColor(past.toISOString())).toBe("text-red-600");
  });

  it("returns red for items expiring within 7 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    expect(getExpiryStatusColor(soon.toISOString())).toBe("text-red-500");
  });

  it("returns amber for items expiring within 30 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 20);
    expect(getExpiryStatusColor(soon.toISOString())).toBe("text-amber-500");
  });

  it("returns green for items not expiring soon", () => {
    const far = new Date();
    far.setDate(far.getDate() + 60);
    expect(getExpiryStatusColor(far.toISOString())).toBe("text-green-600");
  });
});
