# Demo limitations — production implementation required

This concept demo is intentionally client-side only. The following require a real platform before production use.

## Security & identity

- Role switcher is **not** authentication or authorization
- No SSO, MFA, SCIM, or least-privilege enforcement
- No tenant isolation or data residency controls

## Persistence & audit

- Zustand + `localStorage` is not durable multi-user storage
- Audit events are append-only in demo memory only — not WORM / hash-chained
- Receipts as data URLs will hit browser quota; no object storage

## Financial controls

- No multi-entity / multi-currency ledger
- No tax engines, retainage, or progress billing retainers beyond demo rules
- No period close, revenue recognition (ASC 606) automation, or audit lock
- Allocation ledger is in-process; production needs transactional locking and idempotent APIs

## Integrations

- No QuickBooks / NetSuite / Sage / Dynamics connectors
- CSV/JSON export is a sample handoff package only
- No email delivery, e-sign, or client portal

## Workflow

- No notifications, SLA timers, or delegated approvers
- No mobile native apps (responsive web only)
- Limited CRUD vs full project setup / rate card management

## Compliance

- Not SOC 2 evidence, not SOX control-ready
- Synthetic data only — do not treat figures as DST commercial facts
