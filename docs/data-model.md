# FarmOps — Data Model

*What the tables are called, what they mean, and where the model is going.*

---

## 1. Domain narrative (the point of all these tables)

> **FarmOps helps medium-size farms reduce input waste and coordinate field
> operations across planting, maintenance, and harvest seasons.**

Every table exists to serve one of four questions:

1. **What do we have?** — stock in stores, by lot, with expiry and cost.
2. **What did we do with it?** — movements, operations, purchases, counts.
3. **What went wrong?** — waste, loss, variance, disease.
4. **What did the season earn?** — harvest out versus inputs in.

Today's schema answers (1)–(3) well and (4) partially. The redesign in
[PRODUCT_REDESIGN.md](./PRODUCT_REDESIGN.md) Part IV moves the *center of
gravity* from the store (item-centric) to the field (crop-cycle-centric).

## 2. Current schema (19 models, `prisma/schema.prisma`)

### Tenancy & identity

| Model | Role | Notes |
|---|---|---|
| `Farm` | **Tenant root** | everything scopes to it |
| `User` | Person | `role` (5 tiers), nullable `farmId` — null = unassigned → sees nothing (fail-closed) |
| `AuditLog` | Append-only trail | actor, action, entity, old/new values, IP |
| `Notification` | Per-user inbox | also abused for reset-token digests — see §4 |

### Catalog (shared — known gap)

| Model | Role | Notes |
|---|---|---|
| `Category` | Item grouping | ⚠️ not tenant-scoped; pollutable across farms |
| `Supplier` | Vendor | ⚠️ same |
| `InventoryItem` | Product definition | ⚠️ same; carries reorder points, shelf life |

### Stock (the core today)

| Model | Role | Notes |
|---|---|---|
| `Warehouse` | Physical store | **has `farmId`** — this is how batches inherit tenancy |
| `InventoryBatch` | One received lot | qty + qtyRemaining, price, expiry; **no own `farmId`** — scoped through `warehouse` |
| `StockTransaction` | Movement event | type enum (ISSUED/MOVED/…), `farmId` direct |
| `StockAdjustment` | Count correction | vs. counted quantities |
| `StockCount` + `StockCountItem` | Physical count session | scoped via `warehouse.farmId` |

### Procurement & requests

| Model | Role |
|---|---|
| `PurchaseOrder` + `PurchaseOrderItem` | What we ordered (has `farmId`) |
| `ResourceRequest` | Internal ask for inputs (has `farmId`) |
| `WasteRecord` | Loss with reason + estimated value (has `farmId`) |

### Season (proto-crop-domain)

| Model | Role | Notes |
|---|---|---|
| `Season` | Calendar period | `cropType` is a free string; underused today |
| `SeasonInventoryPlan` | Season × item expectation | planned vs actual bridge — nothing consumes it yet |

**Key relationships:**

```
Farm ─┬─ Warehouse ─── InventoryBatch ─── InventoryItem ── Category
      │        └── StockCount ── StockCountItem
      ├─ StockTransaction (batch, from/to warehouse, farm)
      ├─ PurchaseOrder ── PurchaseOrderItem
      ├─ ResourceRequest
      ├─ WasteRecord (batch, farm)
      ├─ Season ── SeasonInventoryPlan
      └─ User (farmId, role) · AuditLog
```

## 3. Tenancy rules (the invariants)

1. **Ownership is transitive through `Warehouse`.** A batch belongs to a farm
   iff its warehouse does. Batch queries scope via
   `warehouse: { farmId: scope }`.
2. **Models with a direct `farmId`** (`StockTransaction`, `PurchaseOrder`,
   `ResourceRequest`, `WasteRecord`, `Season`) scope on that column.
3. **Scope comes from the session**, never the URL —
   [security/tenant-isolation.md](./security/tenant-isolation.md).
4. **Unassigned user ⇒ empty view** (`NO_FARM_MATCH`), never full view.
5. New table ⇒ new rule: it must either carry `farmId` or hang off
   something that does, and it gets a row in the isolation doc's coverage
   table.

## 4. Warts we know about (and plan for)

| # | Problem | Why it matters | Plan |
|---|---|---|---|
| 1 | **Shared catalog** — `Category`/`Supplier`/`InventoryItem` lack `farmId` | A tenant can pollute others' catalogs | nullable `farmId` (null = shared template); P3 security backlog |
| 2 | **Reset tokens stored in `Notification.message`** (`RESET_TOKEN:<digest>`) | Type-unsafe by construction — a `STOCK_ADJUSTED` notification type doubles as a token slot | dedicated `PasswordResetToken { tokenHash, expiresAt, usedAt }` table; P2 |
| 3 | **`Season.cropType` is a string** | No link from a planting to the seed lots it consumed | becomes `CropCycle` aggregate root (below) |
| 4 | **`InventoryBatch` is overloaded** | Seed lots (germination, treatment) and fertilizer bags share one shape | split: `SeedLot` vs generic `InputLot` |
| 5 | **`StockTransaction.type` does three jobs** | Issue-to-operation, move-between-stores, and count-correction have different guards | split into `StockMove` / `Issue` / `CountCorrection` events |
| 6 | **`Decimal` ⇄ `Number`** | Every calculation site calls `Number()`; recurring bug source | centralize conversions in the P0 DTO layer |
| 7 | **`ResourceRequest` name** | Storage vocabulary, not farm vocabulary | rename `InputRequest` as part of IA work |

## 5. Target model (delta from the redesign)

The crop-production context described in
[PRODUCT_REDESIGN.md](./PRODUCT_REDESIGN.md) Part IV, summarized:

```
Season ── CropCycle (aggregate root: crop, variety, status, sown/harvest windows)
              ├── Plot*            (hectares, GeoJSON geometry)
              ├── FieldOperation*  (SOWING/WEEDING/SPRAYING/HARVEST… planned vs done)
              │       └── OperationInput*  (consumed lots → stock deduction)
              ├── SeedLotUsage     (which lot, which plot, at what rate)
              ├── FertilizerPlan ── PlanEntry (stage, product, kg/ha, window)
              ├── DiseaseEvent     (severity, symptom, yield impact %)
              ├── WeatherImpactEvent (FLOOD/DROUGHT/HEAT…, yield impact %)
              ├── HarvestBatch*    (qty, grade, destination, price)
              └── EquipmentUsage   (machine, hours, fuel)
```

`*` = has its own lifecycle. Status enum for a cycle:
`PLANNING → LAND_PREP → SOWN → VEGETATIVE → FLOWERING → HARVESTING → CLOSED`.

## 6. Migration strategy

**Not a big bang.** Four phases, each deployable:

1. **Add** the new aggregates beside the old (`CropCycle`, `Plot`,
   `FieldOperation`…). No existing table changes.
2. **Adapt reads**: an adapter presents `InventoryItem`+batch as `InputLot`
   to new code; old pages keep working untouched.
3. **Re-point workflows** one at a time (Requests → FieldOperations; Waste →
   LossRecord under the cycle). Old writes stop; reads still work.
4. **Drop** `ResourceRequest`, `StockAdjustment`, `SeasonInventoryPlan`
   once nothing reads them; split `StockTransaction` with the
   expand/contract pattern from [deployment.md](./deployment.md) §9.

Rules for every step: forward-compatible migrations only, expand/contract
for anything destructive, seed data re-runnable, and `prisma migrate dev`
(never `db push`) for anything that reaches production (ADR-003).

## 7. Conventions

- IDs: `cuid()` strings (globally unique, no enumeration affordance).
- Money: `Decimal @db.Decimal(14,2)`; quantities `Decimal(14,3)`.
  Convert at the DTO edge only.
- Timestamps: `createdAt`/`updatedAt` on every entity; event entities carry
  their own semantic time (`reportedAt`, `harvestedAt`, `countDate`).
- Enums: schema-level (`SeasonStatus`, transaction types) — never
  string-literals in code.
- Every tenant-scoped table: `@@index([farmId])`, plus composite indexes as
  query patterns stabilize.
- Delete rules are explicit: nothing cascades silently from `Farm`.
