# FarmOps — Product Redesign, Domain Model & Roadmap

**Roles:** Principal Engineer · Product Designer · Startup CTO · Senior UX Researcher
**Date:** 2026-09-30
**Companion document:** [`docs/SECURITY_AUDIT.md`](./SECURITY_AUDIT.md)

---

## Part I — Diagnosis: why this app reads as AI-generated

I audited every page, the nav, the schema, and the API surface. The tell is not one thing — it's a *pattern of defaults*. A human who has worked on a farm writes software differently from someone who has only ever seen farm software described in a pitch deck.

**Evidence from the codebase:**

1. **The nav is an alphabetical inventory of CRUD entities, not a job.** 18 top-level items — Dashboard, Inventory, Warehouses, Transactions, Requests, Farms, Suppliers, QR Scanner, Intelligence, Alerts, Purchase Orders, Waste, Stock Count, Seasons, Notifications, Reports, Audit Log, Settings. A farmer does not think in "Purchase Orders vs Requests vs Stock Count"; they think *"what needs doing on the farm this week, and what stock is short?"*

2. **The dashboard is six generic metric cards** (`Total Items`, `Inventory Value`, `Low Stock Items`, `Pending Requests`, `Active Farms`, `Transactions`) each with a pastel icon box — the exact template shape produced by every "SaaS dashboard" generator. `src/app/(dashboard)/dashboard/page.tsx:195-200` is literally an array of `{title, value, icon, color, bgColor}`.

3. **The domain vocabulary is warehouse-operations vocabulary, not agriculture.** The schema has `InventoryItem`, `InventoryBatch`, `StockTransaction`, `Warehouse` — this is a spares-management system that could manage printer cartridges. The words *crop cycle*, *seed lot*, *field*, *plot*, *sowing*, *harvest*, *application rate*, *yield* appear nowhere in `prisma/schema.prisma`.

4. **"Intelligence" is a tabbed page of weighted moving averages** branded with a `Brain` icon. Nothing in it is specific to agriculture — no weather, no phenology, no soil. The icon list (`Brain, Zap, Target, Shield, TrendingUp`) is the tell: decorative intelligence rather than domain intelligence.

5. **Seasons are an afterthought** — a CRUD page (`name, startDate, endDate, cropType, status`) with a `SeasonInventoryPlan` join that nothing on the dashboard consumes. The most agricultural concept in the schema is the least integrated.

6. **Everything is a list page with a search box.** `PageHeader` + `SearchInput` + table + `ConfirmDialog` + form drawer — repeated 15 times. Uniformity here isn't "design system"; it's absence of design decisions.

7. **`GH₵` currency + `kg/bags/liters` units everywhere** tells us the real market (Ghana, smallholder-to-commercial), yet the UX assumes a desktop warehouse manager. No offline story, no low-bandwidth path, no field-entry ergonomics for someone standing in a field with a phone.

**Verdict:** the app is a *generic inventory template with agricultural nouns sprinkled on top*. The fix is not cosmetic — it is to make agriculture the organizing structure of the information architecture.

---

## Part II — Product identity & narrative

### The one-sentence identity

> **FarmOps is the season, not the spreadsheet.** It answers one question every morning: *what does this farm need today, given where the crop is in its cycle?*

### Positioning (CTO view)

- **Not:** "ERP for farms" (competing with Odoo/SAP = death)
- **Not:** "Farm management for enterprises" (long sales cycles, incumbents)
- **Yes:** *the operational nervous system for a mid-size African farm enterprise* — the person who owns 20–500 hectares across 2–6 plots, employs 10–100 seasonal workers, buys inputs on credit, and sells through 2–3 channels.
- **Wedge:** input-stock + crop-cycle accountability. Nobody else ties "which seed lot went into which plot at which rate" to "what did that plot yield" and "what did we waste." That traceability is what buyers, lenders, and export auditors now ask for.

### Brand voice

- **Grounded, not rustic.** No barn-wood textures, no cartoon tractors. Think *field notebook meets instrument panel*: soil-tone neutrals (loam `#3E2F23`, millet `#C9A227`), a working green (`#2F6B3A`), warning clay (`#B4531F`). One accent max per screen.
- **Language:** verbs farmers use — *Plan the season. Order inputs. Sow. Apply. Harvest. Account for loss.* Not "Create Purchase Order Record."
- **Name:** keep **FarmOps** (it's plain and credible), but stop writing `FarmOps Report — Page 1 of 2` like a template. Reports are named for the season: *"2026 Major Season — Input usage, Northern plots."*

---

## Part III — Feature diet: the smallest set that earns its keep

Today: 21 pages, 49 API routes, ~19,800 LOC of app code, 19 Prisma models. Roughly **40% of the surface area serves no distinct farmer workflow.**

### KEEP — the core loop (8 surfaces)

| Surface | Replaces | Why it earns its place |
|---|---|---|
| **Season home** (replaces Dashboard) | 6 metric cards | One screen per season: crop stage, plots, what's due, what's short |
| **Crop cycle board** | Inventory / Seasons split | The spine of the product — every input, op, and harvest hangs off a cycle |
| **Field operations log** | Requests + Stock Count (merged) | What was done, by whom, what it consumed |
| **Inputs store** (rename Inventory) | Inventory + Warehouses (merged) | Seed lots, fertilizer, chem — batches *are* seed lots |
| **Harvest & loss** (merge Waste into it) | Waste, part of Transactions | Harvest batches + loss accounting = the P&L moment |
| **Money trail** (thin) | Transactions + Purchase Orders | What inputs cost, what harvest earned |
| **Sync/scan (mobile-first)** | QR Scanner + Import/Export | Field reality: scan a bag, record a splly, works offline |
| **Alerts strip** | Alerts + Intelligence + Notifications (merged) | One ranked list: expiry, short stock, disease, weather |

### CUT or FOLD (8 surfaces)

| Current surface | Verdict | Reasoning |
|---|---|---|
| Dashboard (generic) | **Replace** | Metric-card grid has zero decision value |
| Intelligence page | **Fold** | "Forecast" tab → a row inside Alerts; delete the Brain branding |
| Reports (5 charts) | **Fold** | Exports become "Season summary" actions on the season home |
| Audit Log | **Move** | Settings → Security; it's compliance, not a daily destination |
| Notifications page | **Fold** | Bell + Alerts strip; a page nobody visits twice |
| Settings/Categories | **Fold** | Inline editing where categories are chosen |
| Settings/Integrations, Webhooks, API keys | **Demote** | One Settings → Integrations page; webhook CRUD is admin plumbing |
| Suppliers, Farms as top-level | **Demote** | Reference data under Settings / season header, not nav |

**Nav goes from 18 items to 5:** *Season · Field ops · Inputs · Harvest & loss · Money* — plus a collapsed *More* (Suppliers, Reports, Settings).

---

## Part IV — Domain-driven design

### Bounded contexts

```
┌────────────────────────────────────────────────────────────┐
│  CROP PRODUCTION (core domain — where differentiation lives)│
│  CropCycle · Field/Plot · SeedLot · FertilizerPlan ·        │
│  FieldOperation · DiseaseEvent · WeatherImpact · HarvestBatch│
├────────────────────────────────────────────────────────────┤
│  INPUTS & STORES (supporting)                               │
│  Store · InputItem · SeedLot(provenance) · StockMove ·      │
│  PurchaseOrder · Supplier · StockCount · LossRecord         │
├────────────────────────────────────────────────────────────┤
│  EQUIPMENT (supporting)                                     │
│  Machine · EquipmentUsage · MaintenanceEvent                │
├────────────────────────────────────────────────────────────┤
│  IDENTITY & TENANCY (generic/supporting)                    │
│  Tenant(Farm) · User · Role · Membership                    │
├────────────────────────────────────────────────────────────┤
│  ACCOUNTING (generic — integrate, don't build)              │
│  CostEvent · SaleEvent → export to spreadsheet/QuickBooks   │
└────────────────────────────────────────────────────────────┘
```

**Key DDD decisions:**

1. **`CropCycle` is the aggregate root**, not `InventoryItem`. Everything references it: operations, applications, harvests, losses, weather impacts. A season contains 1..n crop cycles; a cycle spans 1..n plots.
2. **`InventoryBatch` becomes two distinct concepts.** Seed lots carry germination %, supplier, variety, treatment — they *expire in the field* differently than bags in a store. Fertilizer/chem stock stays generic `InputLot`.
3. **`StockTransaction` splits by intent.** `Issue(to operation)` vs `Move(between stores)` vs `Adjust(count/loss)` are different events with different guards — one overloaded enum is the classic schema smell.
4. **The shared-catalog problem (see SECURITY_AUDIT §8) is solved by design:** `Category`/`Supplier` gain nullable `farmId` (null = shared template), so tenant isolation falls out of the model instead of being patched per-route.
5. **Ubiquitous language rule:** no model may be named after its UI widget (`StockAdjustment`, `ResourceRequest` are storage names; rename to `CountCorrection` and `InputRequest` and the API follows).

### Target schema sketch (delta, not full DDL)

```prisma
model CropCycle {
  id           String   @id @default(cuid())
  farmId       String
  seasonId     String
  name         String           // "Tomato — Block A, Major 2026"
  crop         String           // tomato, maize, soybean
  variety      String?
  status       CycleStatus      // PLANNING → LAND_PREP → SOWN → VEGETATIVE
                              // → FLOWERING → HARVESTING → CLOSED
  sownAt       DateTime?
  expectedHarvest DateTime?
  plots        Plot[]
  operations   FieldOperation[]
  seedLots     SeedLotUsage[]
  harvests     HarvestBatch[]
  @@index([farmId, status])
}

model Plot {
  id        String @id @default(cuid())
  farmId    String
  cycleId   String?
  name      String           // "Block A3"
  hectares  Decimal  @db.Decimal(8,3)
  geometry  Json?            // GeoJSON polygon — map-first views
  soilNote  String?
}

model SeedLot {
  id          String @id @default(cuid())
  farmId      String
  lotNumber   String         // supplier lot code
  variety     String
  germination Percent?       // the number a farmer actually checks
  treated     Boolean @default(false)
  receivedAt  DateTime
  expiresAt   DateTime?
  supplierId  String?
}

model FertilizerPlan {
  id        String @id @default(cuid())
  cycleId   String
  entries   PlanEntry[]      // {stage, product, rateKgHa, window}
}

model FieldOperation {
  id         String @id @default(cuid())
  cycleId    String
  type       OpType          // LAND_PREP, SOWING, WEEDING, IRRIGATION,
                            // SPRAYING, SCOUTING, FERTILIZING, HARVEST
  plannedAt  DateTime
  doneAt     DateTime?
  doneById   String?
  inputs     OperationInput[] // what it consumed → ties to lots
}

model DiseaseEvent {
  id         String @id @default(cuid())
  cycleId    String
  detectedAt DateTime
  severity   Severity        // WATCH → ACTION → LOST
  symptom    String
  diagnosis  String?
  action     String?
  yieldImpactPercent Decimal?
}

model WeatherImpactEvent {
  id       String @id @default(cuid())
  cycleId  String?
  eventAt  DateTime
  kind     WeatherKind      // FLOOD, DROUGHT, HEAT, STORM, UNTIMELY_RAIN
  note     String?
  yieldImpactPercent Decimal?
}

model HarvestBatch {
  id          String @id @default(cuid())
  cycleId     String
  harvestedAt DateTime
  quantity    Decimal
  unit        String         // kg / crate / bag
  grade       String?        // A / B / reject
  destination String?        // Market X, Contract Y
  priceAtSale Decimal?
}

model EquipmentUsage {
  id         String @id @default(cuid())
  machineId  String
  cycleId    String?
  operationId String?
  hours      Decimal
  fuelLiters Decimal?
  date       DateTime
}
```

**Migration strategy:** this is a rewrite-in-place over 4–6 weeks, *not* a big-bang. Phase 1 adds the new aggregates beside the old (adapter reads old `InventoryItem` as `InputLot`); Phase 2 re-points one workflow at a time; Phase 3 drops `StockAdjustment`/`ResourceRequest`.

---

## Part V — UX: replacing admin-dashboard patterns

### 1. Map-first home (replaces the card grid)

The default screen is **the farm map**: GeoJSON plot polygons, each tinted by its current crop-cycle stage, with a date scrubber. Overlays: operations due today, disease flags, weather warnings. Side rail = "Today on the farm" (3–6 actionable rows).

- No map yet? Ship the **field card grid** — same information, plots as cards with stage progress bars. The map is a rendering detail, not the IA.
- Every plot card: stage chip, days-to-harvest estimate, last operation, inputs applied, flag count.

### 2. Seasonal timeline (replaces Reports)

A horizontal Gantt/phenology strip per crop cycle: sowing → stages → planned harvest windows, with **operation markers below** and **input applications stacked** as fuel. Weather impact events render as vertical bands so "the flood in week 6" is visually adjacent to the yield dip. This is the screen where the product stops looking generic — no template contains it.

### 3. Farm operation workflows (replaces dialogs)

Operations are *flows*, not forms: **Plan → Assign → Do (mobile, offline) → Consumed inputs auto-deducted → Done.** "Spray" pre-fills the fertilizer/chem plan entry and asks only for actual rate + who did it. The record writes `FieldOperation` + `OperationInput` + stock deduction in one transaction.

### 4. Inventory movement visualization (replaces Transactions table)

One sankey/flow view per cycle: *Stores → Operations → Crop → Harvest/Loss*. The transactions table becomes the drill-down. A farmer should be able to answer "where did the 40 bags of NPK go?" without reading rows.

### 5. Crop lifecycle management (the signature screen)

`CropCycle` detail = a vertical lifecycle rail: **Plan → Procure seed → Land prep → Sow → Grow (ops) → Scout (disease events) → Harvest (batches) → Close & review.** Each stage shows its own artifacts and a "stage complete" gate. Closing a cycle produces the review: inputs used, yield, loss, margin.

### 6. Field-first non-negotiables (mobile)

- 3 taps to record any common operation; camera-first (scan lot → auto-fill).
- Offline queue with visible sync state — field connectivity is the default assumption.
- Big targets, no hover-only affordances, single primary action per screen.
- Voice-note attachment on disease events (typing in a field is unrealistic).

---

## Part VI — Code that looks machine-generated (and the refactor patterns)

| Smell | Where | The experienced-engineer pattern |
|---|---|---|
| **Copy-pasted route shape** — every handler inlines try/catch + identical error JSON | 49 × `route.ts` | Route handler = thin adapter. Extract `handleXxx(request, ctx)` domain functions; one `withRoute(fn, {auth, schema, rateLimit})` wrapper. Cuts ~1,500 LOC. |
| **`any`-typed client state** (`useState<any[]>`, `data.totalItems` untyped) | most pages | Define response DTOs in `src/lib/dto/*.ts`; pages import them. Discriminated unions for status fields kill the `"UNKNOWN" as Status` casts. |
| **Client-side aggregation of server data** — dashboard fetches 6 endpoints then `new Map()`-reduces in the browser | `dashboard/page.tsx:104-145` | Server does aggregation (`/api/seasons/home` returns the composed view). One request, one payload, testable reducer. |
| **Effects-by-`useEffect` chain** — every page hand-rolls fetch/loading/error | all pages | One `useResource<T>(key, deps)` hook (or SWR/React Query). Removes ~40 lines/page of boilerplate. |
| **Magic enums as strings** (`"ACTIVE"`, `"STOCK_ADJUSTED"` reused as token type) | schema + code | `as const` maps + Zod enums generated from Prisma (`prisma-zod-generator`). Reset tokens living in `Notification.type` is this smell at its worst — a `PasswordResetToken` table with TTL. |
| **N+1 loops with awaits** | `alerts` POST, `import` | `createMany` + chunking; `Promise.all` bounded by a small pool. |
| **Decorator icons around undifferentiated content** | `Intelligence` (Brain/Zap/Shield), stat cards | Delete icons that carry no information. Icons earn their place only when they encode status. |
| **Giant single-file pages** (447 / 401 / 474 LOC) | dashboard, inventory, intelligence | Container/presentational split: `*-container.tsx` (data) + `*-view.tsx` (pure render) → view components become testable without mocks. |
| **Duplicated scoping/auth logic creeping per-route** (pre-audit) | API | Already fixed via `resolveFarmScope` + `mutationGuard`; keep it *one* module and add the CI guard-rail test from SECURITY_AUDIT §5. |

---

## Part VII — Scores

| Dimension | Now | After roadmap | Why not higher/lower |
|---|---|---|---|
| **Product authenticity** | 3.0 | 8.5 | Now: agricultural nouns on a warehouse app. After: crop cycles are the spine. 8.5 not 10 until validated with real farms. |
| **Security** | 3.0 → **7.5** (fixed this session) | 8.5 | Residual: in-memory keys/rate-limits, login throttle, CSP (SECURITY_AUDIT §10) |
| **Maintainability** | 4.0 | 7.5 | `any`-heavy pages, duplicated route shells, no DTO layer; good: tests exist, TypeScript strict-ish, clean lint |
| **Architecture** | 4.0 | 8.0 | Was: entity CRUD organized by table. After DDD: aggregate-rooted, tenant-scoped by construction, composed views |
| **UX** | 3.0 | 8.5 | Was: 18-item nav + card grid + 15 identical tables. After: 5-item nav, map/timeline/flow/lifecycle |
| **Business viability** | 5.0 | 8.0 | Real market (GH₵, kg/bags), real pain; unproven: distribution, offline sync cost, willingness to pay |
| **Weighted overall** | **4.0** | **8.5** | |

**Honest note on the 8.5 claim:** every dimension above 8 assumes the *execution* items in the roadmap land. The security dimension is already at 7.5 in this working tree; the rest are design-complete here but code-incomplete.

---

## Part VIII — Prioritized roadmap: 4/10 → 8.5/10

### P0 — Foundation (week 1–2) → 5.5
1. **Land this session's security work** (guard rail CI test, delete `/api/seed` prod path, login throttle). *Effort: 1 day.*
2. **DTO layer + `useResource` hook** — type the API boundary, kill `any` and effect-boilerplate. *3–4 days.*
3. **Nav collapse to 5 sections** with legacy routes redirected (old URLs keep working). *1–2 days.*
4. **Season home v1** — replaces card grid: cycle stage summary + "today's ops" + short-stock strip. Server-composed `/api/seasons/home`. *3 days.*

### P1 — Domain spine (week 3–5) → 6.5
5. **`CropCycle` + `Plot` aggregates** with migration adapter over `Season`/`Farm`. *1 week.*
6. **`SeedLot` split** from generic stock (germination, treatment, provenance) + seed-usage link to cycles. *4 days.*
7. **`FieldOperation` flow** replacing Requests + Stock Count as the daily write path; auto stock deduction. *1 week.*
8. **Split `StockTransaction`** into Issue/Move/Adjust with per-type guards. *3 days.*

### P2 — Signature UX (week 6–8) → 7.5
9. **Crop lifecycle rail** on cycle detail (stage gates). *4 days.*
10. **Seasonal timeline** (phenology + ops + weather bands) replacing Reports. *1 week.*
11. **Inventory movement flow view** (sankey) per cycle. *4 days.*
12. **Mobile/offline capture** for operations (camera scan, queue + sync indicator). *1 week.*

### P3 — Differentiation (week 9–11) → 8.0
13. **Disease events + weather impact events** with yield-impact attribution on the timeline. *4 days.*
14. **`FertilizerPlan` → actual rate comparison** ("planned vs applied" per stage). *3 days.*
15. **`EquipmentUsage`** capture tied to operations. *3 days.*
16. **Harvest batches → margin review** closing the cycle ("what this block earned"). *4 days.*

### P4 — Hardening to 8.5 (week 12+)
17. Security P1/P2 items from SECURITY_AUDIT §10 (DB-backed keys, Redis limits, CSP, seed-route removal). *3 days.*
18. **Tenant-scoped shared catalog** (nullable `farmId`) + tenant-scope-by-construction review. *2 days.*
19. **5-user field validation** with real farms in Ghana — instrument where they hesitate; the score past 8.5 comes from evidence, not code. *ongoing.*

### What I would *not* build
- ❌ AI chat assistants / "crop disease AI" before the data model exists
- ❌ Payroll, HR, accounting suites (integrate instead)
- ❌ Marketplace/multi-vendor (different company)
- ❌ Custom chart builder (six fixed views beat infinite fiddling)
- ❌ Webhooks/API-key self-service UI for small farms (keep admin-only)

---

## Appendix — Immediate quick wins (this week, no schema change)

1. Rename nav labels to verbs: *Plan the season · Do the work · Manage inputs · Account for harvest · Track money*.
2. Delete decorative icons from stat cards; keep only status-bearing ones.
3. Merge Alerts + Intelligence + Notifications into one ranked strip.
4. Move Audit Log, Categories, Webhooks into Settings.
5. Dashboard headline = crop-stage sentence, not a card grid: *"Major 2026 · Maize, Block A — 42 days after sowing, 3 ops due this week."*
6. Reports → "Season summary" print view with the farm's name, not `FarmOps Report — Page 1 of N`.
