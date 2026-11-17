import { getAssignmentRate, getApprovedTimeEntries } from "@/lib/domain/costing";
import type {
  AcceptedUnit,
  AllocationSourceType,
  AppState,
  BillingAllocation,
  Expense,
  Milestone,
  TimeEntry,
} from "@/types";

function activeAllocations(state: AppState): BillingAllocation[] {
  return state.allocations.filter(
    (a) => a.status === "reserved" || a.status === "finalized"
  );
}

export function allocatedForSource(
  state: AppState,
  sourceType: AllocationSourceType,
  sourceId: string
): { quantity: number; amountCents: number } {
  const rows = activeAllocations(state).filter(
    (a) => a.sourceType === sourceType && a.sourceId === sourceId
  );
  return {
    quantity: rows.reduce((s, a) => s + a.quantity, 0),
    amountCents: rows.reduce((s, a) => s + a.amountCents, 0),
  };
}

export interface EligibleTimeItem {
  sourceType: "time_entry";
  sourceId: string;
  projectId: string;
  description: string;
  employeeName: string;
  hoursRemaining: number;
  billRateCents: number;
  amountRemainingCents: number;
  entry: TimeEntry;
}

export interface EligibleExpenseItem {
  sourceType: "expense";
  sourceId: string;
  projectId: string;
  description: string;
  amountRemainingCents: number;
  expense: Expense;
}

export interface EligibleMilestoneItem {
  sourceType: "milestone";
  sourceId: string;
  projectId: string;
  description: string;
  amountRemainingCents: number;
  allowPartial: boolean;
  milestone: Milestone;
}

export interface EligibleUnitItem {
  sourceType: "accepted_unit";
  sourceId: string;
  projectId: string;
  description: string;
  quantityRemaining: number;
  unitPriceCents: number;
  amountRemainingCents: number;
  unit: AcceptedUnit;
}

export type EligibleBillingItem =
  | EligibleTimeItem
  | EligibleExpenseItem
  | EligibleMilestoneItem
  | EligibleUnitItem;

/** T&M: only approved, billable, not fully allocated time */
export function getEligibleTimeItems(
  state: AppState,
  projectId: string
): EligibleTimeItem[] {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project || project.billingModel !== "time_and_materials") return [];

  const items: EligibleTimeItem[] = [];
  for (const entry of getApprovedTimeEntries(state, projectId)) {
    if (!entry.billable) continue;
    const ts = state.timesheets.find((t) => t.id === entry.timesheetId);
    if (!ts) continue;
    const emp = state.employees.find((e) => e.id === ts.employeeId);
    const { billRateCents } = getAssignmentRate(
      state,
      projectId,
      ts.employeeId
    );
    const allocated = allocatedForSource(state, "time_entry", entry.id);
    const hoursRemaining = Math.max(0, entry.hours - allocated.quantity);
    if (hoursRemaining <= 0.0001) continue;
    const amountRemainingCents = Math.round(hoursRemaining * billRateCents);
    items.push({
      sourceType: "time_entry",
      sourceId: entry.id,
      projectId,
      description: `${emp?.name ?? "Employee"} · ${entry.date} · ${hoursRemaining}h`,
      employeeName: emp?.name ?? "Unknown",
      hoursRemaining,
      billRateCents,
      amountRemainingCents,
      entry,
    });
  }
  return items;
}

/** T&M expenses: approved, billable, not fully allocated */
export function getEligibleExpenseItems(
  state: AppState,
  projectId: string
): EligibleExpenseItem[] {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project || project.billingModel !== "time_and_materials") return [];

  const term = state.billingTerms.find((t) => t.projectId === projectId);
  const markup = term?.expenseMarkupPercent ?? 0;

  return state.expenses
    .filter(
      (e) =>
        e.projectId === projectId &&
        e.status === "approved" &&
        e.billable
    )
    .map((expense) => {
      const billableTotal = Math.round(
        expense.amountCents * (1 + markup / 100)
      );
      const allocated = allocatedForSource(state, "expense", expense.id);
      const amountRemainingCents = Math.max(
        0,
        billableTotal - allocated.amountCents
      );
      return {
        sourceType: "expense" as const,
        sourceId: expense.id,
        projectId,
        description: `${expense.category} · ${expense.description}`,
        amountRemainingCents,
        expense,
      };
    })
    .filter((i) => i.amountRemainingCents > 0);
}

/**
 * Fixed fee: only milestones with authorized billable amount remaining.
 * Labor records are NEVER eligible invoice sources for fixed-fee projects.
 */
export function getEligibleMilestoneItems(
  state: AppState,
  projectId: string
): EligibleMilestoneItem[] {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project || project.billingModel !== "fixed_fee") return [];

  const term = state.billingTerms.find((t) => t.projectId === projectId);
  const allowPartial = term?.allowPartialMilestoneBilling ?? false;

  return state.milestones
    .filter(
      (m) =>
        m.projectId === projectId &&
        m.status !== "cancelled" &&
        m.status !== "pending" &&
        m.authorizedBillablePercent > 0
    )
    .map((milestone) => {
      const authorized = Math.round(
        milestone.amountCents * milestone.authorizedBillablePercent
      );
      const allocated = allocatedForSource(state, "milestone", milestone.id);
      const amountRemainingCents = Math.max(
        0,
        authorized - allocated.amountCents
      );
      return {
        sourceType: "milestone" as const,
        sourceId: milestone.id,
        projectId,
        description: `${milestone.code} · ${milestone.name}`,
        amountRemainingCents,
        allowPartial,
        milestone,
      };
    })
    .filter((i) => i.amountRemainingCents > 0);
}

/** Unit price: only accepted units with remaining unallocated quantity */
export function getEligibleUnitItems(
  state: AppState,
  projectId: string
): EligibleUnitItem[] {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project || project.billingModel !== "accepted_units") return [];

  return state.acceptedUnits
    .filter(
      (u) =>
        u.projectId === projectId &&
        (u.status === "accepted" || u.status === "billed")
    )
    .map((unit) => {
      const allocated = allocatedForSource(state, "accepted_unit", unit.id);
      const quantityRemaining = Math.max(0, unit.quantity - allocated.quantity);
      return {
        sourceType: "accepted_unit" as const,
        sourceId: unit.id,
        projectId,
        description: `${unit.siteCode} · ${unit.description}`,
        quantityRemaining,
        unitPriceCents: unit.unitPriceCents,
        amountRemainingCents: Math.round(
          quantityRemaining * unit.unitPriceCents
        ),
        unit,
      };
    })
    .filter((i) => i.quantityRemaining > 0);
}

export function getEligibleBillingItems(
  state: AppState,
  projectId: string
): EligibleBillingItem[] {
  return [
    ...getEligibleTimeItems(state, projectId),
    ...getEligibleExpenseItems(state, projectId),
    ...getEligibleMilestoneItems(state, projectId),
    ...getEligibleUnitItems(state, projectId),
  ];
}

/** Guard: rejected / unapproved / returned expenses must not be invoiced */
export function isExpenseInvoiceEligible(expense: Expense): boolean {
  return expense.status === "approved" && expense.billable;
}

/** Guard: unapproved timesheet entries cannot be invoiced */
export function isTimeEntryInvoiceEligible(
  state: AppState,
  entry: TimeEntry
): boolean {
  const ts = state.timesheets.find((t) => t.id === entry.timesheetId);
  return Boolean(ts && ts.status === "approved" && entry.billable);
}
