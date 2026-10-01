import { describe, it, expect } from "vitest";
import { buildSecurityHeaders } from "@/lib/security-headers";

describe("Production security headers", () => {
  const prodHttps = buildSecurityHeaders({ isHttps: true, isDev: false });
  const prodHttp = buildSecurityHeaders({ isHttps: false, isDev: false });
  const dev = buildSecurityHeaders({ isHttps: false, isDev: true });

  it("sets a CSP with a restrictive default and no plugin sources", () => {
    const csp = prodHttps["Content-Security-Policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("does not enable eval in production scripts", () => {
    expect(prodHttps["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    expect(dev["Content-Security-Policy"]).toContain("'unsafe-eval'");
  });

  it("sets HSTS only for HTTPS requests", () => {
    expect(prodHttps["Strict-Transport-Security"]).toContain("max-age=");
    expect(prodHttp["Strict-Transport-Security"]).toBeUndefined();
  });

  it("sets the standard browser hardening headers", () => {
    for (const headers of [prodHttps, prodHttp, dev]) {
      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["Permissions-Policy"]).toContain("camera=()");
    }
  });

  it("adds upgrade-insecure-requests only over HTTPS", () => {
    expect(prodHttps["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
    expect(prodHttp["Content-Security-Policy"]).not.toContain("upgrade-insecure-requests");
  });

  it("permits dev HMR websockets only in development", () => {
    expect(dev["Content-Security-Policy"]).toContain("ws:");
    expect(prodHttps["Content-Security-Policy"]).not.toContain("ws:");
  });
});
