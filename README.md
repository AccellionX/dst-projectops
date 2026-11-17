# DST ProjectOps — Concept Demo

Independent speculative pre-sales prototype for an engineering operations platform covering projects, timesheets, expenses, approvals, job costing, billing engines, audit trails, and accounting handoff packaging.

**Concept Demo • Synthetic Data.** This is **not** an authorized DST Engineers product. It does not use real customer data, rates, budgets, or live accounting integrations.

## Prerequisites

- **Node.js ≥ 20.9** (Next.js 16 requirement)
- npm 10+

```bash
# If you use nvm:
nvm use 20
```

## Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (redirects to `/overview`).

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Local development server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript `--noEmit` |
| `npm test` | Vitest domain unit tests |

## Role simulation (no real authentication)

Use the **top-bar role switcher**. This is explicitly labeled as role simulation.

| Persona | Employee | Capabilities (demo) |
|---------|----------|---------------------|
| Administrator | Avery Chen | All functions + reset |
| Project Manager | Jordan Hale | Assigned projects, approvals, costing |
| Engineer | Riley Santos / Morgan Lee | Own time & expenses on assigned projects |
| Accounting | Casey Nguyen | Invoices, exports, audit, costing |

## Guided walkthrough

Open **Guided Demo** (`/settings`) and follow the 12-step script:

1. Switch to Engineer (Riley)
2. Open weekly timesheet
3. Enter hours on Solar + BESS (`BESS-2026-017`)
4. Submit for approval
5. Switch to PM (Jordan)
6. Approve in Approvals
7. Review Job Costing
8. Switch to Accounting (Casey)
9. Create invoice draft from eligible items
10. Attempt duplicate allocation (`Demo: duplicate billing attempt`)
11. Observe prevention toast + allocation ledger
12. Export CSV + sample JSON handoff

Use **Reset Demo Data** (Admin) to restore the deterministic seed.

## Seeded synthetic projects

| Code | Client (fictional) | Model | Notes |
|------|--------------------|-------|-------|
| `SPV-2026-041` | Helios Grid Partners LLC | Fixed fee $120k | Milestone billing; labor is cost-only |
| `BESS-2026-017` | Prairie Ridge Renewables Inc | T&M ceiling $85k | Hours × client bill rates |
| `FIELD-2026-009` | Cascade Utility Services | $350 / accepted inspection | Only accepted units billable |

## Architecture

```
src/
  app/(dashboard)/     # App Router pages
  components/          # UI modules + shadcn-style primitives
  lib/
    domain/            # Costing, approvals, IDs
    billing/           # Eligibility + invoice allocation ledger
    permissions/       # Role simulation checks
    audit/             # Append-only demo audit helpers
    seed/              # Deterministic synthetic seed
    format/            # USD cents formatting
  store/               # Zustand + localStorage persistence
  types/               # Domain TypeScript models
tests/domain/          # Vitest pure-function tests
docs/                  # Handoff schema + limitations
```

Money is stored as **integer USD cents**. Billing uses a deterministic **allocation ledger**: drafts **reserve**, void **releases**, export **finalizes**.

## Documentation

- [Accounting handoff schema & CSV mapping](docs/ACCOUNTING_HANDOFF.md)
- [Demo limitations / production gaps](docs/LIMITATIONS.md)
- [Guided demo expected outputs](docs/GUIDED_DEMO.md)

## Duplicate billing prevention

Every billable source (`time_entry`, `expense`, `milestone`, `accepted_unit`) has remaining quantity/amount after summing `reserved` + `finalized` allocations. Creating a second draft against the same remainder fails with `DUPLICATE_PREVENTED`. Idempotency keys prevent double-click duplicate drafts.
