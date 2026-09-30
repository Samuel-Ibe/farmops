# ADR-002: Multi-tenant design — shared schema, `farmId` discriminator, session-derived scope

**Status:** Accepted
**Date:** 2026-09-30
**Deciders:** Core team
**Supersedes:** the original design, which trusted a client-supplied `?farmId=`

## Context

Every customer is a *farm* (tenant). Users belong to at most one farm; admins
may see across farms. Before this ADR, ~17 routes read `searchParams.get("farmId")`
and used it directly as a query filter — any authenticated user could read any
tenant's stock by changing a URL parameter (`docs/SECURITY_AUDIT.md`, SEC-06).

Options considered for isolation strategy:

1. Database per tenant
2. Schema per tenant
3. Shared schema + tenant discriminator column

## Decision

**Shared schema with a required `farmId` discriminator**, plus a single
server-side scope resolver that is the *only* way a route learns its tenant
scope:

```ts
// src/lib/api-auth.ts
export const NO_FARM_MATCH = "__no_farm__";

export function resolveFarmScope(user: AuthUser, requested?: string | null): string | null {
  if (user.role === "ADMIN") return requested || null;   // admins may scope anywhere
  return user.farmId || NO_FARM_MATCH;                   // nobody assigned → matches nothing
}
```

Rules, in order of authority:

1. **Scope = f(session).** The effective tenant scope comes from the verified
   JWT, never from a query parameter. A query parameter may *narrow* an
   admin's scope; it can never widen anyone's.
2. **`NO_FARM_MATCH` can never equal a cuid.** A user with no farm assigned
   gets an empty result set, not the whole database (fail-closed).
3. **Scope lives in the query.** Lookups are scoped `findFirst`, not
   "fetch then check" — the where clause *is* the authorization check.
4. **404, not 403,** for object-level misses, so IDs can't be probed.
5. **Both ends of every cross-entity write are validated** (e.g. a transfer
   checks source *and* destination warehouse).

## Consequences

**Good:**

- One Postgres, one connection pool, trivial dev/CI setup.
- Tenancy is enforced in one function; a reviewer can verify the invariant
  by reading a single file. Verified across 30+ routes by this audit.
- Adding a farm is an INSERT, not a database.

**Bad / accepted:**

- A missing `WHERE farmId` filter is a data leak, not a compile error. The
  invariant is convention + review + the CI guard-rail check in
  `docs/SECURITY_AUDIT.md` §5 — not the type system. **Wishlist:** Prisma
  client extensions or a repository layer that injects scope automatically.
- Shared indexes mean one tenant's pathological query can affect another's
  latency (not correctness). Mitigated by per-`(farmId, …)` composite indexes
  as query patterns stabilize.
- `Category`, `Supplier`, and `InventoryItem` are still globally shared
  (documented gap — SECURITY_AUDIT §8): a malicious tenant can pollute the
  shared catalog. Planned fix: nullable `farmId` (null = shared template).
  Postponed until it has a customer requirement behind it.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Database per tenant** | Perfect isolation, but N databases to migrate, pool, back up. At our size that's operational suicide. Reconsider only if a customer requires contractual data separation (e.g. export certification). |
| **Schema per tenant** | Middle ground, but Prisma has no first-class support — every migration becomes N× custom work. |
| **Client passes farmId, server trusts it** | This was the original bug. Explicitly rejected: authorization input must come from the verified session. |
| **Row-level security in Postgres** | Strongest database-enforced guarantee, but every connection must set `app.tenant_id`, Prisma pooling makes that awkward, and debugging RLS errors is a tax on a small team. Listed as a candidate if we ever hit the "scope lives in convention" risk above. |

## Verification

- Typecheck + 76-test suite green (`npm test`).
- Route audit table in `docs/SECURITY_AUDIT.md` §5 lists scope status for
  all 49 handlers.
- CI guard: fail the build if any `route.ts` lacks a guard import (whitelisting
  the 4 auth endpoints + dev-only seed).
