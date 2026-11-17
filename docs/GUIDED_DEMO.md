# Guided demo — expected outputs

Reset demo data (Admin) before a live walkthrough so seed IDs remain stable.

## Journey checklist

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Switch to Riley Santos | Banner shows Engineer · role simulation |
| 2–3 | Timesheet week `2026-03-09`, BESS hours | Draft lines on `BESS-2026-017` |
| 4 | Submit | Status `Submitted`; appears in Approvals |
| 5–6 | Jordan Hale approves | Status `Approved`; approval action logged |
| 7 | Job Costing → BESS | Approved labor ↑ by hours × $85 cost rate |
| 8–9 | Casey creates draft from eligible hours | New invoice; allocation `reserved`; hours leave eligibility |
| 10–11 | Duplicate attempt on `te-r1-wed` | Toast: duplicate billing prevented (`DUPLICATE_PREVENTED`) |
| 12 | Export draft | Allocations `finalized`; CSV download; JSON handoff preview |

## Seed fixtures used in the duplicate demo

- `te-r1-wed` — 8h approved BESS time already **reserved** on `INV-DEMO-0004` / `alloc-004`
- Attempting to invoice those hours again must fail until the draft is voided

## After void

Voiding `INV-DEMO-0004` releases `alloc-004` → `te-r1-wed` returns to eligible T&M items.
