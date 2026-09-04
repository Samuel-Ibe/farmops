import { describe, it, expect } from "vitest";
import { parsePaginationParams } from "@/lib/pagination";

describe("parsePaginationParams", () => {
  it("returns defaults when no params provided", () => {
    const params = new URLSearchParams();
    const result = parsePaginationParams(params);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it("parses page and limit from params", () => {
    const params = new URLSearchParams({ page: "3", limit: "50" });
    const result = parsePaginationParams(params);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(100);
  });

  it("enforces minimum page of 1", () => {
    const params = new URLSearchParams({ page: "0" });
    const result = parsePaginationParams(params);
    expect(result.page).toBe(1);
  });

  it("enforces maximum limit of 100", () => {
    const params = new URLSearchParams({ limit: "500" });
    const result = parsePaginationParams(params);
    expect(result.limit).toBe(100);
  });

  it("enforces minimum limit of 1", () => {
    const params = new URLSearchParams({ limit: "0" });
    const result = parsePaginationParams(params);
    expect(result.limit).toBe(1);
  });

  it("uses custom default limit", () => {
    const params = new URLSearchParams();
    const result = parsePaginationParams(params, { limit: 50 });
    expect(result.limit).toBe(50);
  });

  it("handles negative page values", () => {
    const params = new URLSearchParams({ page: "-5" });
    const result = parsePaginationParams(params);
    expect(result.page).toBe(1);
  });

  it("calculates correct offset for page 5 with limit 20", () => {
    const params = new URLSearchParams({ page: "5", limit: "20" });
    const result = parsePaginationParams(params);
    expect(result.offset).toBe(80);
  });
});
