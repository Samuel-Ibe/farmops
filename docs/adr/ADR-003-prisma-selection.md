# ADR-003: ORM selection — Prisma over Drizzle and hand-written SQL

**Status:** Accepted
**Date:** 2026-09-30
**Deciders:** Core team

## Context

FarmOps has 19 models, relations spanning five aggregates (farms → warehouses
→ batches → transactions → reports), and a team that ships features weekly.
The data layer must:

1. Make tenant scoping hard to forget (`WHERE farmId = …` on nearly every query).
2. Generate types end-to-end so pages stop using `any`.
3. Support relational includes (batch → item → category → warehouse → farm)
   without hand-written joins.
4. Be operable by < 5 engineers who are not database specialists.

## Decision

**Prisma ORM (`@prisma/client` ^6.10) with PostgreSQL**, schema-first in
`prisma/schema.prisma`, migrations via `prisma migrate dev`, seed via
`prisma/seed.ts`.

- All access goes through the generated client — there is **no raw SQL in the
  codebase** (`$queryRaw`/`$executeRaw` count: 0), which is also our SQL-injection
  posture (SEC-22).
- Tenant scope is expressed as `where` clauses built from `resolveFarmScope`
  (ADR-002).
- `Decimal` columns for money and quantities; conversion to `Number` happens
  only at the presentation edge.

## Consequences

**Good:**

- Type safety from schema to page: a renamed column breaks the build, not
  production.
- Relations are one `include` away; the audit found no N+1 caused by *missing*
  includes (the N+1s we did find were loops calling `create` — fixed with
  `createMany`).
- `prisma db push` for schema iteration + `migrate dev` for history is a
  workflow the whole team already knows.

**Bad / accepted:**

- **Decimal ⇄ number friction.** Prisma returns `Decimal` objects; every
  calculation site must call `Number()`. This is a recurring source of subtle
  bugs; the DTO layer (roadmap P0) is where we centralize the conversion.
- **The query planner is a black box.** For hot paths (alerts aggregation,
  reports) we can't see the SQL without `prisma --print`. Acceptable at our
  data volumes; would matter at 10× rows.
- **Tenant scope is convention, not schema.** The schema can't express
  "this query must be scoped". Mitigations per ADR-002.
- Client bundle carries the full generated client tree-shaken per-model —
  server-only imports keep it off the wire.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Drizzle** | Genuinely appealing: SQL-shaped, zero codegen, great for edge runtimes. Rejected *for now* because relational includes are manual join objects, the team would write SQL-adjacent code under time pressure, and the migration story is younger. Reconsider for the next greenfield service. |
| **TypeORM / MikroORM** | Decorator + metadata-reflection style ages poorly with `strict: true` and mixes poorly with Next.js server components. |
| **Knex / hand-written SQL** | Maximum control, maximum maintenance. With < 5 engineers, every join is code we own forever. Zero raw SQL also means zero SQL-injection surface — a security property we'd have to earn back deliberately. |
| **Edge-tuned clients (Turso/libSQL)** | Premature: we're on a single Postgres (ADR-004 deployment shape). |

## Notes

- `npm run db:push` is used in dev for speed; **production schema changes
  must go through `migrate dev` + reviewed SQL** — this is called out in
  `docs/deployment.md`.
- Prisma's peer-dep conflict with `nodemailer@10` forces `--legacy-peer-deps`
  at install time; it is documented in `docs/testing.md` so CI and laptops
  behave the same.
