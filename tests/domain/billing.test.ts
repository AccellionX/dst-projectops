import { describe, expect, it } from "vitest";
import {
  getEligibleBillingItems,
  getEligibleMilestoneItems,
  getEligibleTimeItems,
  getEligibleUnitItems,
  isExpenseInvoiceEligible,
  isTimeEntryInvoiceEligible,
} from "@/lib/billing/eligibility";
import {
  createInvoiceDraft,
  exportInvoice,
  voidInvoiceDraft,
} from "@/lib/billing/invoice";
import { getApprovedLaborCost, getProjectCostSummary } from "@/lib/domain/costing";
import { decideTimesheet } from "@/lib/domain/approvals";
import { createSeedState } from "@/lib/seed";
import { resetIdCounter } from "@/lib/domain/ids";

describe("billing & costing domain", () => {
  it("approved timesheet affects project approved costs", () => {
    resetIdCounter();
    let state = createSeedState();
    const before = getApprovedLaborCost(state, "proj-bess");

    // Approve submitted timesheet ts-riley-w3
    const result = decideTimesheet(
      state,
      "ts-riley-w3",
      "emp-pm",
      "approved",
      null
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;

    const after = getApprovedLaborCost(state, "proj-bess");
    // 8h on BESS at Riley cost $85 = 68000 cents (field hours on same sheet go to field project)
    expect(after).toBeGreaterThan(before);
    expect(after - before).toBe(8 * 8500);
  });

  it("unapproved timesheet cannot be invoiced", () => {
    const state = createSeedState();
    // te-r3-mon is on submitted (not approved) timesheet
    const entry = state.timeEntries.find((e) => e.id === "te-r3-mon")!;
    expect(isTimeEntryInvoiceEligible(state, entry)).toBe(false);

    const eligible = getEligibleTimeItems(state, "proj-bess");
    expect(eligible.some((i) => i.sourceId === "te-r3-mon")).toBe(false);
  });

  it("returned/rejected expenses cannot be invoiced", () => {
    const state = createSeedState();
    const returned = state.expenses.find((e) => e.id === "exp-riley-3")!;
    const rejected = state.expenses.find((e) => e.id === "exp-morgan-2")!;
    expect(isExpenseInvoiceEligible(returned)).toBe(false);
    expect(isExpenseInvoiceEligible(rejected)).toBe(false);
  });

  it("fixed-fee billing never bills labor records directly", () => {
    const state = createSeedState();
    // Labor is never an eligible source on fixed-fee projects
    const timeItems = getEligibleTimeItems(state, "proj-spv");
    expect(timeItems).toHaveLength(0);

    // After releasing the MS-02 reservation, milestones become eligible — not labor
    const voided = voidInvoiceDraft(state, "inv-003");
    expect(voided.ok).toBe(true);
    if (!voided.ok) return;
    const milestones = getEligibleMilestoneItems(voided.state, "proj-spv");
    expect(milestones.length).toBeGreaterThan(0);
    expect(
      getEligibleBillingItems(voided.state, "proj-spv").every(
        (i) => i.sourceType === "milestone"
      )
    ).toBe(true);

    const attempt = createInvoiceDraft(voided.state, {
      clientId: "cli-helios",
      projectId: "proj-spv",
      createdById: "emp-acct",
      issueDate: "2026-03-15",
      selections: [
        {
          sourceType: "time_entry",
          sourceId: "te-r1-mon",
          quantity: 8,
          amountCents: 132000,
          description: "illegal labor line",
          unitAmountCents: 16500,
        },
      ],
      idempotencyKey: "test-fixed-fee-labor",
    });
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) {
      expect(attempt.code).toBe("FIXED_FEE_NO_LABOR");
    }
  });

  it("only accepted units are billable", () => {
    const state = createSeedState();
    const units = getEligibleUnitItems(state, "proj-field");
    expect(units.every((u) => u.unit.status === "accepted" || u.unit.status === "billed")).toBe(
      true
    );
    expect(units.some((u) => u.sourceId === "au-field-05")).toBe(false); // submitted
    expect(units.some((u) => u.sourceId === "au-field-06")).toBe(false); // rejected
    expect(units.some((u) => u.sourceId === "au-field-03")).toBe(true);
  });

  it("partially billed items retain correct eligible balance", () => {
    const state = createSeedState();
    // MS-02 authorized 50% of $30k = $15k, fully reserved on inv-003
    const items = getEligibleMilestoneItems(state, "proj-spv");
    const ms2 = items.find((i) => i.sourceId === "ms-spv-2");
    expect(ms2).toBeUndefined();

    // After voiding inv-003, $15k should return
    const voided = voidInvoiceDraft(state, "inv-003");
    expect(voided.ok).toBe(true);
    if (!voided.ok) return;
    const after = getEligibleMilestoneItems(voided.state, "proj-spv");
    const restored = after.find((i) => i.sourceId === "ms-spv-2");
    expect(restored?.amountRemainingCents).toBe(1_500_000);
  });

  it("two draft invoices cannot reserve the same source allocation", () => {
    resetIdCounter();
    const state = createSeedState();
    // te-r1-wed already reserved on inv-004
    const second = createInvoiceDraft(state, {
      clientId: "cli-prairie",
      projectId: "proj-bess",
      createdById: "emp-acct",
      issueDate: "2026-03-15",
      selections: [
        {
          sourceType: "time_entry",
          sourceId: "te-r1-wed",
          quantity: 8,
          amountCents: 140_000,
          description: "dup",
          unitAmountCents: 17500,
        },
      ],
      idempotencyKey: "dup-test-1",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("DUPLICATE_PREVENTED");
    }
  });

  it("voiding draft releases reservation", () => {
    const state = createSeedState();
    const before = getEligibleBillingItems(state, "proj-bess");
    expect(before.some((i) => i.sourceId === "te-r1-wed")).toBe(false);

    const voided = voidInvoiceDraft(state, "inv-004");
    expect(voided.ok).toBe(true);
    if (!voided.ok) return;

    const after = getEligibleBillingItems(voided.state, "proj-bess");
    expect(after.some((i) => i.sourceId === "te-r1-wed")).toBe(true);
  });

  it("exported allocations remain protected from duplicate billing", () => {
    const state = createSeedState();
    // au-field-01 finalized on inv-002
    const units = getEligibleUnitItems(state, "proj-field");
    expect(units.some((u) => u.sourceId === "au-field-01")).toBe(false);

    const attempt = createInvoiceDraft(state, {
      clientId: "cli-cascade",
      projectId: "proj-field",
      createdById: "emp-acct",
      issueDate: "2026-03-15",
      selections: [
        {
          sourceType: "accepted_unit",
          sourceId: "au-field-01",
          quantity: 1,
          amountCents: 35000,
          description: "dup unit",
          unitAmountCents: 35000,
        },
      ],
      idempotencyKey: "dup-unit",
    });
    expect(attempt.ok).toBe(false);
  });

  it("export finalizes reserved allocations and is idempotent", () => {
    resetIdCounter();
    let state = createSeedState();
    const exported = exportInvoice(state, "inv-004", "export-key-1");
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    state = exported.state;
    const alloc = state.allocations.find((a) => a.id === "alloc-004");
    expect(alloc?.status).toBe("finalized");

    const again = exportInvoice(state, "inv-004", "export-key-1");
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.reused).toBe(true);
  });

  it("seed reset is deterministic", () => {
    const a = createSeedState();
    const b = createSeedState();
    expect(a.projects.length).toBe(b.projects.length);
    expect(a.allocations.find((x) => x.id === "alloc-004")?.status).toBe(
      "reserved"
    );
    const summary = getProjectCostSummary(a, "proj-bess");
    expect(summary?.totalApprovedCostCents).toBeGreaterThan(0);
  });
});
