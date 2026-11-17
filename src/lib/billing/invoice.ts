import { createId, invoiceNumber } from "@/lib/domain/ids";
import {
  getEligibleBillingItems,
  type EligibleBillingItem,
} from "@/lib/billing/eligibility";
import type {
  AllocationSourceType,
  AppState,
  BillingAllocation,
  InvoiceDraft,
  InvoiceLine,
} from "@/types";
import { addDays, formatISO, parseISO } from "date-fns";

export interface AllocationRequest {
  sourceType: AllocationSourceType;
  sourceId: string;
  /** Hours, units, or 1 for amount-based */
  quantity: number;
  /** Amount in cents to allocate */
  amountCents: number;
  description: string;
  unitAmountCents: number;
}

export interface InvoiceCreateInput {
  clientId: string;
  projectId: string;
  createdById: string;
  issueDate: string;
  notes?: string;
  selections: AllocationRequest[];
  idempotencyKey: string;
}

export type InvoiceResult =
  | { ok: true; state: AppState; invoiceId: string; reused?: boolean }
  | { ok: false; error: string; code: string };

function findEligible(
  items: EligibleBillingItem[],
  sourceType: AllocationSourceType,
  sourceId: string
): EligibleBillingItem | undefined {
  return items.find(
    (i) => i.sourceType === sourceType && i.sourceId === sourceId
  );
}

function validateSelection(
  items: EligibleBillingItem[],
  sel: AllocationRequest
): string | null {
  const eligible = findEligible(items, sel.sourceType, sel.sourceId);
  if (!eligible) {
    return `Source ${sel.sourceType}:${sel.sourceId} is not eligible or has no remaining balance (duplicate billing prevented).`;
  }

  if (sel.amountCents <= 0 || sel.quantity <= 0) {
    return "Allocation quantity and amount must be positive.";
  }

  if (eligible.sourceType === "time_entry") {
    if (sel.quantity > eligible.hoursRemaining + 0.0001) {
      return `Cannot allocate ${sel.quantity}h; only ${eligible.hoursRemaining}h remaining.`;
    }
  } else if (eligible.sourceType === "accepted_unit") {
    if (sel.quantity > eligible.quantityRemaining + 0.0001) {
      return `Cannot allocate ${sel.quantity} units; only ${eligible.quantityRemaining} remaining.`;
    }
  } else if (eligible.sourceType === "milestone") {
    if (!eligible.allowPartial && sel.amountCents < eligible.amountRemainingCents) {
      return "Partial milestone billing is not authorized for this contract.";
    }
    if (sel.amountCents > eligible.amountRemainingCents) {
      return `Milestone remaining balance is ${eligible.amountRemainingCents} cents.`;
    }
  } else if (eligible.sourceType === "expense") {
    if (sel.amountCents > eligible.amountRemainingCents) {
      return `Expense remaining balance is ${eligible.amountRemainingCents} cents.`;
    }
  }

  // Fixed-fee safety: never allow time_entry as source when project is fixed fee
  // (eligibility already filters, but double-check)
  return null;
}

export function createInvoiceDraft(
  state: AppState,
  input: InvoiceCreateInput
): InvoiceResult {
  // Idempotency: reuse existing draft with same key
  const existing = state.invoices.find(
    (i) => i.idempotencyKey === input.idempotencyKey
  );
  if (existing) {
    return { ok: true, state, invoiceId: existing.id, reused: true };
  }

  if (input.selections.length === 0) {
    return {
      ok: false,
      error: "Select at least one eligible billing item.",
      code: "EMPTY_SELECTION",
    };
  }

  const project = state.projects.find((p) => p.id === input.projectId);
  if (!project) {
    return { ok: false, error: "Project not found.", code: "NOT_FOUND" };
  }

  // Hard rule: fixed-fee invoices cannot include labor lines
  if (project.billingModel === "fixed_fee") {
    const labor = input.selections.find((s) => s.sourceType === "time_entry");
    if (labor) {
      return {
        ok: false,
        error:
          "Fixed-fee billing never invoices labor records directly. Use milestones.",
        code: "FIXED_FEE_NO_LABOR",
      };
    }
  }

  const eligible = getEligibleBillingItems(state, input.projectId);

  // Validate all selections against current remaining balances
  // Simulate sequential reservation to prevent double-pick in same request
  const simulated = new Map<string, { qty: number; amt: number }>();

  for (const sel of input.selections) {
    const key = `${sel.sourceType}:${sel.sourceId}`;
    const base = findEligible(eligible, sel.sourceType, sel.sourceId);
    if (!base) {
      return {
        ok: false,
        error: `Duplicate billing prevented: ${sel.sourceType} ${sel.sourceId} has no remaining balance.`,
        code: "DUPLICATE_PREVENTED",
      };
    }
    const used = simulated.get(key) ?? { qty: 0, amt: 0 };
    const err = validateSelection(eligible, {
      ...sel,
      quantity:
        sel.sourceType === "time_entry" || sel.sourceType === "accepted_unit"
          ? sel.quantity
          : sel.quantity,
      amountCents: sel.amountCents,
    });
    // Re-check against simulated prior picks in this draft
    if (base.sourceType === "time_entry") {
      if (used.qty + sel.quantity > base.hoursRemaining + 0.0001) {
        return {
          ok: false,
          error: "Duplicate billing prevented within the same draft.",
          code: "DUPLICATE_PREVENTED",
        };
      }
    } else if (base.sourceType === "accepted_unit") {
      if (used.qty + sel.quantity > base.quantityRemaining + 0.0001) {
        return {
          ok: false,
          error: "Duplicate billing prevented within the same draft.",
          code: "DUPLICATE_PREVENTED",
        };
      }
    } else {
      if (used.amt + sel.amountCents > base.amountRemainingCents) {
        return {
          ok: false,
          error: "Duplicate billing prevented within the same draft.",
          code: "DUPLICATE_PREVENTED",
        };
      }
    }
    if (err) {
      return { ok: false, error: err, code: "VALIDATION" };
    }
    simulated.set(key, {
      qty: used.qty + sel.quantity,
      amt: used.amt + sel.amountCents,
    });
  }

  const client = state.clients.find((c) => c.id === input.clientId);
  const dueDate = formatISO(
    addDays(parseISO(input.issueDate), client?.paymentTermsDays ?? 30),
    { representation: "date" }
  );

  const seq =
    state.invoices.filter((i) => i.status !== "void").length + 1;
  const invoiceId = createId("inv");
  const now = new Date().toISOString();

  const allocations: BillingAllocation[] = [];
  const lines: InvoiceLine[] = [];
  let subtotal = 0;

  for (const sel of input.selections) {
    const allocationId = createId("alloc");
    allocations.push({
      id: allocationId,
      invoiceId,
      sourceType: sel.sourceType,
      sourceId: sel.sourceId,
      quantity: sel.quantity,
      amountCents: sel.amountCents,
      status: "reserved",
      createdAt: now,
      releasedAt: null,
      finalizedAt: null,
    });
    lines.push({
      id: createId("line"),
      invoiceId,
      sourceType: sel.sourceType,
      sourceId: sel.sourceId,
      description: sel.description,
      quantity: sel.quantity,
      unitAmountCents: sel.unitAmountCents,
      amountCents: sel.amountCents,
      allocationId,
    });
    subtotal += sel.amountCents;
  }

  const invoice: InvoiceDraft = {
    id: invoiceId,
    number: invoiceNumber(seq),
    clientId: input.clientId,
    projectId: input.projectId,
    status: "draft",
    issueDate: input.issueDate,
    dueDate,
    subtotalCents: subtotal,
    taxCents: 0,
    totalCents: subtotal,
    notes: input.notes ?? "",
    createdById: input.createdById,
    exportedAt: null,
    voidedAt: null,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  };

  // Mark accepted units as billed when fully allocated
  const acceptedUnits = state.acceptedUnits.map((u) => {
    const newly = allocations.filter(
      (a) => a.sourceType === "accepted_unit" && a.sourceId === u.id
    );
    if (newly.length === 0) return u;
    const prior = state.allocations.filter(
      (a) =>
        a.sourceType === "accepted_unit" &&
        a.sourceId === u.id &&
        (a.status === "reserved" || a.status === "finalized")
    );
    const totalQty =
      prior.reduce((s, a) => s + a.quantity, 0) +
      newly.reduce((s, a) => s + a.quantity, 0);
    if (totalQty >= u.quantity && u.status === "accepted") {
      return { ...u, status: "billed" as const };
    }
    return u;
  });

  const milestones = state.milestones.map((m) => {
    const newly = allocations.filter(
      (a) => a.sourceType === "milestone" && a.sourceId === m.id
    );
    if (newly.length === 0) return m;
    const authorized = Math.round(
      m.amountCents * m.authorizedBillablePercent
    );
    const prior = state.allocations.filter(
      (a) =>
        a.sourceType === "milestone" &&
        a.sourceId === m.id &&
        (a.status === "reserved" || a.status === "finalized")
    );
    const total =
      prior.reduce((s, a) => s + a.amountCents, 0) +
      newly.reduce((s, a) => s + a.amountCents, 0);
    if (total >= authorized) {
      return { ...m, status: "fully_billed" as const };
    }
    if (total > 0) {
      return { ...m, status: "partially_billed" as const };
    }
    return m;
  });

  return {
    ok: true,
    invoiceId,
    state: {
      ...state,
      invoices: [...state.invoices, invoice],
      invoiceLines: [...state.invoiceLines, ...lines],
      allocations: [...state.allocations, ...allocations],
      acceptedUnits,
      milestones,
    },
  };
}

export function voidInvoiceDraft(
  state: AppState,
  invoiceId: string
): InvoiceResult {
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  if (!invoice) {
    return { ok: false, error: "Invoice not found.", code: "NOT_FOUND" };
  }
  if (invoice.status === "exported") {
    return {
      ok: false,
      error: "Exported invoices cannot be voided in this demo.",
      code: "ALREADY_EXPORTED",
    };
  }
  if (invoice.status === "void") {
    return { ok: true, state, invoiceId, reused: true };
  }

  const now = new Date().toISOString();
  const allocations = state.allocations.map((a) =>
    a.invoiceId === invoiceId && a.status === "reserved"
      ? { ...a, status: "released" as const, releasedAt: now }
      : a
  );

  // Restore unit/milestone status based on remaining active allocations
  const acceptedUnits = state.acceptedUnits.map((u) => {
    const still = allocations.filter(
      (a) =>
        a.sourceType === "accepted_unit" &&
        a.sourceId === u.id &&
        (a.status === "reserved" || a.status === "finalized")
    );
    const qty = still.reduce((s, a) => s + a.quantity, 0);
    if (u.status === "billed" && qty < u.quantity) {
      return { ...u, status: "accepted" as const };
    }
    return u;
  });

  const milestones = state.milestones.map((m) => {
    const still = allocations.filter(
      (a) =>
        a.sourceType === "milestone" &&
        a.sourceId === m.id &&
        (a.status === "reserved" || a.status === "finalized")
    );
    const amt = still.reduce((s, a) => s + a.amountCents, 0);
    const authorized = Math.round(
      m.amountCents * m.authorizedBillablePercent
    );
    if (amt <= 0 && (m.status === "partially_billed" || m.status === "fully_billed")) {
      return {
        ...m,
        status:
          m.authorizedBillablePercent >= 1
            ? ("ready_to_bill" as const)
            : ("in_progress" as const),
      };
    }
    if (amt > 0 && amt < authorized) {
      return { ...m, status: "partially_billed" as const };
    }
    return m;
  });

  return {
    ok: true,
    invoiceId,
    state: {
      ...state,
      invoices: state.invoices.map((i) =>
        i.id === invoiceId
          ? { ...i, status: "void" as const, voidedAt: now, updatedAt: now }
          : i
      ),
      allocations,
      acceptedUnits,
      milestones,
    },
  };
}

export function exportInvoice(
  state: AppState,
  invoiceId: string,
  exportIdempotencyKey: string
): InvoiceResult {
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  if (!invoice) {
    return { ok: false, error: "Invoice not found.", code: "NOT_FOUND" };
  }
  if (invoice.status === "void") {
    return { ok: false, error: "Cannot export a void invoice.", code: "VOID" };
  }
  if (invoice.status === "exported") {
    // Idempotent export
    if (invoice.idempotencyKey === exportIdempotencyKey || true) {
      return { ok: true, state, invoiceId, reused: true };
    }
  }

  const now = new Date().toISOString();
  const allocations = state.allocations.map((a) =>
    a.invoiceId === invoiceId && a.status === "reserved"
      ? { ...a, status: "finalized" as const, finalizedAt: now }
      : a
  );

  return {
    ok: true,
    invoiceId,
    state: {
      ...state,
      invoices: state.invoices.map((i) =>
        i.id === invoiceId
          ? {
              ...i,
              status: "exported" as const,
              exportedAt: now,
              updatedAt: now,
              idempotencyKey: exportIdempotencyKey,
            }
          : i
      ),
      allocations,
    },
  };
}

export interface AccountingHandoffPayload {
  schemaVersion: "1.0";
  generatedAt: string;
  disclaimer: string;
  invoice: {
    number: string;
    clientCode: string;
    clientName: string;
    projectCode: string;
    issueDate: string;
    dueDate: string;
    currency: "USD";
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    lines: {
      description: string;
      quantity: number;
      unitAmountCents: number;
      amountCents: number;
      sourceType: string;
      sourceId: string;
    }[];
  };
  mappingHints: Record<string, string>;
}

export function buildAccountingHandoff(
  state: AppState,
  invoiceId: string
): AccountingHandoffPayload | null {
  const invoice = state.invoices.find((i) => i.id === invoiceId);
  if (!invoice) return null;
  const client = state.clients.find((c) => c.id === invoice.clientId);
  const project = state.projects.find((p) => p.id === invoice.projectId);
  const lines = state.invoiceLines.filter((l) => l.invoiceId === invoiceId);

  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Sample canonical accounting handoff payload for manual import. This demo does not integrate with live accounting systems.",
    invoice: {
      number: invoice.number,
      clientCode: client?.code ?? "",
      clientName: client?.name ?? "",
      projectCode: project?.code ?? "",
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: "USD",
      subtotalCents: invoice.subtotalCents,
      taxCents: invoice.taxCents,
      totalCents: invoice.totalCents,
      lines: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitAmountCents: l.unitAmountCents,
        amountCents: l.amountCents,
        sourceType: l.sourceType,
        sourceId: l.sourceId,
      })),
    },
    mappingHints: {
      invoice_number: "AP/AR Invoice Number",
      client_code: "Customer Master ID",
      project_code: "Job / Project Dimension",
      amount_cents: "Divide by 100 for currency amount",
      source_type: "Originating billable artifact for audit",
    },
  };
}

export function buildInvoiceCsv(state: AppState, invoiceId: string): string {
  const payload = buildAccountingHandoff(state, invoiceId);
  if (!payload) return "";
  const header = [
    "invoice_number",
    "client_code",
    "client_name",
    "project_code",
    "issue_date",
    "due_date",
    "line_description",
    "quantity",
    "unit_amount_usd",
    "amount_usd",
    "source_type",
    "source_id",
  ].join(",");
  const rows = payload.invoice.lines.map((l) =>
    [
      payload.invoice.number,
      payload.invoice.clientCode,
      `"${payload.invoice.clientName}"`,
      payload.invoice.projectCode,
      payload.invoice.issueDate,
      payload.invoice.dueDate,
      `"${l.description.replace(/"/g, '""')}"`,
      l.quantity,
      (l.unitAmountCents / 100).toFixed(2),
      (l.amountCents / 100).toFixed(2),
      l.sourceType,
      l.sourceId,
    ].join(",")
  );
  return [header, ...rows].join("\n");
}
