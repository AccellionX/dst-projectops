# Accounting handoff (sample)

This demo exports a **sample** canonical JSON payload and CSV for **manual** accounting import illustration. It does **not** integrate with QuickBooks, NetSuite, Sage, or any live GL.

## JSON schema (v1.0)

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "ISO-8601 timestamp",
  "disclaimer": "Sample canonical accounting handoff…",
  "invoice": {
    "number": "INV-DEMO-0004",
    "clientCode": "PRR-02",
    "clientName": "Prairie Ridge Renewables Inc",
    "projectCode": "BESS-2026-017",
    "issueDate": "YYYY-MM-DD",
    "dueDate": "YYYY-MM-DD",
    "currency": "USD",
    "subtotalCents": 140000,
    "taxCents": 0,
    "totalCents": 140000,
    "lines": [
      {
        "description": "…",
        "quantity": 8,
        "unitAmountCents": 17500,
        "amountCents": 140000,
        "sourceType": "time_entry",
        "sourceId": "te-…"
      }
    ]
  },
  "mappingHints": {
    "invoice_number": "AP/AR Invoice Number",
    "client_code": "Customer Master ID",
    "project_code": "Job / Project Dimension",
    "amount_cents": "Divide by 100 for currency amount",
    "source_type": "Originating billable artifact for audit"
  }
}
```

### Validation expectations (production)

| Check | Rule |
|-------|------|
| Currency | Must be `USD` for this demo contract set |
| Totals | `sum(lines.amountCents) === subtotalCents === totalCents - taxCents` |
| Amounts | Integer cents; never floating point money |
| Sources | `sourceId` must exist and allocation must be `finalized` |
| Idempotency | Same export key must not create a second AR document |

## CSV field mapping

| CSV column | Suggested import field | Notes |
|------------|------------------------|-------|
| `invoice_number` | Invoice / Document No. | Unique per export |
| `client_code` | Customer ID | Map via customer master |
| `client_name` | Customer name (display) | Soft match only |
| `project_code` | Job / class / dimension | Required for job costing GL |
| `issue_date` | Invoice date | ISO date |
| `due_date` | Due date | Based on payment terms |
| `line_description` | Line memo | Free text |
| `quantity` | Quantity | Hours or units |
| `unit_amount_usd` | Rate | Decimal dollars |
| `amount_usd` | Extended amount | Decimal dollars |
| `source_type` | Custom segment / memo | Audit origin |
| `source_id` | External ref | Prevents re-import duplicates |

## Intended production mapping

1. Create/find Customer by `client_code`
2. Create Invoice header with dates and terms
3. Create lines with amount = `quantity × unit_amount` (validate vs `amount_usd`)
4. Post to AR with project dimension = `project_code`
5. Store `source_type`+`source_id` as external IDs to block re-billing
