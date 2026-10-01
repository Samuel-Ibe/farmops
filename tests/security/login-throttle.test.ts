import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  resetRateLimits,
  resetLoginFailures,
  isLoginThrottled,
  recordLoginFailure,
  clearLoginFailures,
} from "@/lib/rate-limit";

describe("Rate limiting", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests under the limit and blocks the one after", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("ip:1", 5, 60_000).allowed).toBe(true);
    }
    expect(checkRateLimit("ip:1", 5, 60_000).allowed).toBe(false);
  });

  it("keys are independent", () => {
    expect(checkRateLimit("ip:1", 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit("ip:2", 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit("ip:1", 1, 60_000).allowed).toBe(false);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    try {
      expect(checkRateLimit("ip:w", 1, 1000).allowed).toBe(true);
      expect(checkRateLimit("ip:w", 1, 1000).allowed).toBe(false);
      vi.advanceTimersByTime(1001);
      expect(checkRateLimit("ip:w", 1, 1000).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Login throttling (brute force, no lockout DoS)", () => {
  beforeEach(() => {
    resetRateLimits();
    resetLoginFailures();
  });

  it("blocks after 5 failed attempts from the same IP+account", () => {
    for (let i = 0; i < 5; i++) {
      recordLoginFailure("ip1:victim@farm.com");
    }
    expect(isLoginThrottled("ip1:victim@farm.com")).toBe(true);
  });

  it("does not throttle the same account from a different IP (no lockout DoS)", () => {
    for (let i = 0; i < 5; i++) {
      recordLoginFailure("ip1:victim@farm.com");
    }
    expect(isLoginThrottled("ip2:victim@farm.com")).toBe(false);
    expect(isLoginThrottled("ip1:other@farm.com")).toBe(false);
  });

  it("clears failures after a successful login", () => {
    for (let i = 0; i < 4; i++) recordLoginFailure("ip1:user@farm.com");
    expect(isLoginThrottled("ip1:user@farm.com")).toBe(false);
    clearLoginFailures("ip1:user@farm.com");
    recordLoginFailure("ip1:user@farm.com");
    expect(isLoginThrottled("ip1:user@farm.com")).toBe(false);
  });

  it("throttle expires with the failure window", () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 5; i++) recordLoginFailure("ip3:user@farm.com");
      expect(isLoginThrottled("ip3:user@farm.com")).toBe(true);
      vi.advanceTimersByTime(15 * 60 * 1000 + 1);
      expect(isLoginThrottled("ip3:user@farm.com")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
