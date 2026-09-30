# FarmOps — Tenant Isolation

**Invariant:** *a request can only ever read or write rows belonging to its
own farm, unless the session role is ADMIN.*

This document explains how that invariant is implemented, how it can break,
and how we check it. Findings history: [../SECURITY_AUDIT.md](../SECURITY_AUDIT.md) (SEC-06, SEC-07, SEC-13).

---

## 1. Model

Tenancy is a **shared schema with a `farmId` discriminator**
([../adr/ADR-002-multi-tenant-design.md](../adr/ADR-002-multi-tenant-design.md)).

```
User  ──farmId──►  Farm ◄──farmId── Warehouse ◄──warehouseId── InventoryBatch
                     ▲                  ▲                          │
                     │                  │                          │
              PurchaseOrder        StockCount                 StockTransaction (farmId)
              ResourceRequest      Season                     WasteRecord (farmId)
```

Ownership of a row is *transitive*: a batch is in Farm X iff its warehouse is
in Farm X. That's why batch queries scope through
`warehouse: { farmId: scope }` rather than carrying their own `farmId`.

## 2. The one function

```ts
// src/lib/api-auth.ts
export const NO_FARM_MATCH = "__no_farm__";

export function resolveFarmScope(user: AuthUser, requested?: string | null): string | null {
  if (user.role === "ADMIN") return requested || null;
  return user.farmId || NO_FARM_MATCH;
}
```

Three deliberate properties:

1. **Session-derived.** `user` comes from the verified JWT (`requireAuth`),
   never from the query string. A `?farmId=` parameter can only *narrow* an
   admin's view.
2. **Fails closed.** `user.farmId` is nullable in the schema (a freshly
   registered user has none). Returning `NO_FARM_MATCH` — a string that can
   never equal a cuid — makes such users see **nothing** instead of
   **everything**. The original code returned "everything".
3. **`null` means "unscoped", and only admins get it.** Callers branch on
   `farmScope !== null`; forgetting the branch yields unscoped *reads* only
   in admin paths, where it's intended.

## 3. Usage patterns

### List queries — scope inside the `where`

```ts
const scope = resolveFarmScope(user, searchParams.get("farmId"));
await prisma.purchaseOrder.findMany({
  where: { ...(scope !== null && { farmId: scope }) },
});
```

### Aggregate through the owning relation

```ts
// batches have no farmId of their own
where: { ...(scope !== null && { warehouse: { farmId: scope } }) }
```

### Object access — scoped lookup, 404 on miss

```ts
const po = await prisma.purchaseOrder.findFirst({
  where: { id, ...(scope !== null && { farmId: scope }) },
});
if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
```

**404, not 403.** A 403 confirms the ID exists — an existence oracle that
turns enumeration into a map of the competitor's records.

### Writes — validate both ends

```ts
// batches/transfer: source batch AND destination warehouse must be in scope
if (scope !== null && sourceBatch.warehouse.farmId !== scope) return 404;
if (scope !== null && targetWarehouse.farmId !== scope) return 404;
```

A write that only checks one end lets an attacker *push* data across the
boundary even if they can't read it.

### Exports — scope every sheet

CSV, Excel (4 sheets), and PDF all apply the same scope; the audit found
and fixed branches where a scope variable was computed and then ignored in
one handler (SEC-13).

## 4. Coverage

| Surface | Scoped | Notes |
|---|---|---|
| Collection GETs (inventory, transactions, POs, requests, waste, farms, warehouses, seasons, reports, alerts, batches, stock-count) | ✅ | via `resolveFarmScope` |
| Per-ID GET/PATCH/DELETE (10 route files) | ✅ | scoped `findFirst` |
| Cross-entity mutations (split, transfer) | ✅ | both ends validated |
| Exports (CSV / Excel / PDF) | ✅ | all sheets/sections |
| QR lookup (4 fallback queries) | ✅ | including the fuzzy item match |
| External API (`/api/external/*`) | ✅ | pinned key's `farmId` wins over any requested one |
| Notifications | ✅ | scoped by `userId`, which implies farm |
| Admin surfaces (audit-log, intelligence, users) | by design | cross-farm, role-gated |

Known gap: `Category`, `Supplier`, `InventoryItem` are **globally shared**
(no `farmId`). Not a confidentiality break (they're catalog entries), but a
tenant can pollute another's catalog. Fix: nullable `farmId` (null = shared)
— tracked in SECURITY_AUDIT §8.

## 5. How it can break

| Failure mode | Example | Guard |
|---|---|---|
| Scope computed but not applied | `const scope = …` then a query without it | Review checklist + route audit table |
| New model without `farmId` | Adding `Equipment` and forgetting tenancy | PR template question: *"Is this tenant-scoped? Which column?"* |
| Client-side scoping mistaken for security | UI hides other farms' data — server still must enforce | Server-side rule: UI is never the boundary |
| `requested` accidentally trusted for non-admins | `resolveFarmScope(user, req)` is safe *only* because of the role branch | Keep the branch in the one function; unit-test it |
| Raw SQL bypassing Prisma | `$queryRaw` with string interpolation | Grep gate: zero raw SQL in repo |

## 6. Verification

1. **Unit tests** for `resolveFarmScope`: admin+requested, admin+none,
   member+farm, member+no-farm → four cases, asserting `NO_FARM_MATCH`
   for the last (planned — currently covered by code review; see
   [../testing.md](../testing.md)).
2. **Route sweep** — every `route.ts` must import a guard:
   ```bash
   for f in $(find src/app/api -name route.ts); do
     grep -qE "requireAuth|requireRole|mutationGuard|validateApiKey" "$f" || echo "UNGUARDED: $f"
   done
   ```
   (whitelist: `auth/*` public endpoints, `seed` dev-only)
3. **Audit table** in [../SECURITY_AUDIT.md](../SECURITY_AUDIT.md) §5 —
   per-route scope status, reviewed quarterly.
4. **Ad-hoc pen-test script:** register two users, assign to farms A and B,
   replay every GET with B's ids while authenticated as A → expect 404/empty
   everywhere. This is the single highest-value manual test we run.

## 7. Change protocol

Adding a tenant-scoped model requires, in one PR:

1. `farmId String` + `@@index([farmId])` (or an owner relation whose side has it).
2. Collection route: `resolveFarmScope` in the `where`.
3. `[id]` route: scoped `findFirst` → 404.
4. A row in the §5 table above.
5. The adversarial check from §6.4 against the new route.
