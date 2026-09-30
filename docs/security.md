# FarmOps — Security

*Entry point for everything security-related. Deep documents live in
[`docs/security/`](./security/); full findings history in
[`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).*

---

## Current posture

| Measure | Status |
|---|---|
| Critical vulnerabilities (prod deps) | **0** |
| High vulnerabilities (prod deps) | **0** (2 moderate, accepted — see below) |
| Authenticated API routes | **45/49 guarded**; 4 intentionally public auth endpoints |
| Tenant isolation | **100% of data routes** scoped server-side via `resolveFarmScope` |
| Ownership checks | **100% of per-ID mutations** (scoped lookup → 404) |
| Raw SQL | **0 occurrences** (Prisma parameterized-only) |
| Audit logging | On every mutation: actor, IP, old/new values |

**Overall: 7.5/10** (up from 3/10 pre-audit — scoring rationale in
[SECURITY_AUDIT.md](./SECURITY_AUDIT.md) §9).

## Documents

| Doc | What it answers |
|---|---|
| [security/threat-model.md](./security/threat-model.md) | What are we protecting, from whom, and what's explicitly out of scope (STRIDE) |
| [security/tenant-isolation.md](./security/tenant-isolation.md) | How Farm A can never see Farm B — the invariant, the one function, how it breaks |
| [security/api-security.md](./security/api-security.md) | Guard stack, rate limits, CSRF, uploads, SSRF, keys — the endpoint rulebook |
| [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) | All 25 findings with severities, remediation, and code (the record of what was fixed) |

## The five rules

1. **Guard every route.** Writes go through `mutationGuard`; reads through
   `requireAuth`/`requireRole`. New route without a guard = CI failure.
2. **Scope is derived from the session**, never from a query parameter.
   `resolveFarmScope(user)` is the only source of tenant truth.
3. **Object access is a scoped `findFirst`, and a miss returns 404** — never
   "fetch then check", never 403 for existence.
4. **Validate bodies with Zod; unknown keys are stripped.** Authorization
   fields (`role`, `farmId`) are assigned server-side or not at all.
5. **Log every mutation** with actor, IP, and before/after values.

## Open items (roadmap)

| Priority | Item | Ref |
|---|---|---|
| P1 | Login throttling + progressive backoff | SEC-19 |
| P1 | DB-backed, hashed API keys; Redis rate limits | SEC-18 |
| P1 | Delete `/api/seed` from production builds | SEC-17 |
| P2 | Security headers + CSP | SEC-21 |
| P2 | Enforce API-key `permissions[]`; cap alert fan-out | — |
| P3 | Magic-byte upload sniffing; reset token via URL fragment; hash-chained audit log | SEC-20/21/25 |
| P3 | Tenant-scope the shared catalog (`Category`, `Supplier`) | §8 of audit |

## Accepted risks (documented on purpose)

- **2 moderate prod-dep advisories** (`uuid` via `exceljs`): the vulnerable
  buffer path isn't reachable from our usage; fix requires an upstream major.
- **JWT claim staleness** — a role change takes effect on token refresh;
  high-impact routes re-read the DB (ADR-001).
- **Middleware checks cookie presence, not validity** — it's a redirect UX;
  `auth()` on each data path is the boundary (SEC-16).

## Reporting

Security issues are handled privately: open a confidential advisory to the
maintainers rather than a public issue. We aim to acknowledge within 48
hours and credit reporters who want it.
