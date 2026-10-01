/**
 * Production security headers, built in one place so middleware (and tests)
 * share the exact same policy.
 */

export interface SecurityHeaderOptions {
  /** Request arrived over HTTPS (directly or via terminating proxy). */
  isHttps: boolean;
  /** Development mode: Next.js dev tooling needs eval + HMR websockets. */
  isDev: boolean;
}

export function buildSecurityHeaders({ isHttps, isDev }: SecurityHeaderOptions): Record<string, string> {
  const connectSrc = isDev ? "'self' ws:" : "'self'";
  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' is required by Next.js's inline bootstrap scripts;
    // nonce-based CSP is the follow-up (documented in docs/security.md).
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const headers: Record<string, string> = {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "X-DNS-Prefetch-Control": "off",
  };

  if (isHttps) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  }

  return headers;
}
