# ADR-001: Authentication strategy — NextAuth v5 with JWT sessions

**Status:** Accepted
**Date:** 2026-09-30
**Deciders:** Core team

## Context

FarmOps needs email/password auth for five roles across multiple farms, with
session data (`id`, `role`, `farmId`) available to both Server Components and
route handlers. Deployment target is a single Node instance (see
[ADR-004](./ADR-004-storage-strategy.md)) behind TLS.

Requirements:

1. Role + tenant id must be readable on every request without a DB round-trip.
2. No session table to purge, migrate, or scale horizontally.
3. Password reset must be safe against token theft from the database.
4. Team size < 5 — we cannot maintain a home-grown auth stack.

## Decision

We use **NextAuth (Auth.js) v5 beta with the `jwt` session strategy**:

- `authorize()` returns only `{ id, name, email, role, farmId }` — never the
  password hash, never anything client-supplied.
- The `jwt` callback copies those five claims into the token; the `session`
  callback mirrors them onto `session.user`.
- Route handlers read the session through a single wrapper
  (`getAuthUser` / `requireAuth` in `src/lib/api-auth.ts`) so there is exactly
  one place that knows how claims are shaped.
- Password reset tokens are **never** in a session: they are random 32-byte
  values whose SHA-256 digest alone is persisted, with a 1-hour TTL and
  single-use redemption (see `docs/SECURITY_AUDIT.md`, SEC-03).

## Consequences

**Good:**

- Zero session-store infrastructure; a request is authenticated from the
  signed cookie alone.
- One seam (`src/lib/api-auth.ts`) to audit when claims change.
- Rotating a user's role/farm takes effect on next token refresh rather than
  requiring session invalidation plumbing on day one.

**Bad / accepted:**

- **Claim staleness.** A demoted admin keeps admin claims until the JWT
  refreshes. Mitigation: sensitive routes (`/api/users`, `/api/audit-log`,
  role changes) re-read the user row from the DB before acting. We accept the
  minutes-scale window elsewhere.
- **We are on a beta.** next-auth `5.0.0-beta.25+` is pre-stable. Pinned in
  `package-lock.json`; upgrades go through the test suite, not `^` drift.
- Logout is client-side token discard; a stolen cookie works until expiry.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Database sessions** (Auth.js `strategy: "database"`) | Every request hits the DB for session lookup; adds a table we must prune; buys us revocation we don't yet need. Revisit if/when we add "log out all devices". |
| **Roll our own HMAC cookie** | Weeks of work to reach what Auth.js gives (CSRF, cookie flags, provider plumbing), and we'd own every future CVE. |
| **Stateful session in Redis** | Right answer at multi-instance scale; premature for one Node process. Redis is already on the roadmap for rate limiting (SEC-18) — sessions can move there with it. |
| **OAuth/SSO provider** | Our users are farm staff with email addresses, not enterprise IdP tenants. Adds a dependency without a customer asking for it. |

## Notes

- Middleware only checks cookie *presence* as a redirect heuristic — it is
  **not** the security boundary (SEC-16). Every data path calls `auth()`.
- JWT callback whitelists claims explicitly; adding a claim is a deliberate
  two-file change, not an accident.
