import type {
  AppState,
  Expense,
  Project,
  TimeEntry,
  Timesheet,
} from "@/types";

function activeAllocations(state: AppState) {
  return state.allocations.filter(
    (a) => a.status === "reserved" || a.status === "finalized"
  );
}

export function getAssignmentRate(
  state: AppState,
  projectId: string,
  employeeId: string
): { costRateCents: number; billRateCents: number } {
  const assignment = state.assignments.find(
    (a) => a.projectId === projectId && a.employeeId === employeeId && a.active
  );
  const employee = state.employees.find((e) => e.id === employeeId);
  return {
    costRateCents:
      assignment?.costRateCents ?? employee?.defaultCostRateCents ?? 0,
    billRateCents: assignment?.billRateCents ?? 0,
  };
}

export function getApprovedTimesheets(state: AppState): Timesheet[] {
  return state.timesheets.filter((t) => t.status === "approved");
}

export function getApprovedTimeEntries(
  state: AppState,
  projectId?: string
): TimeEntry[] {
  const approvedIds = new Set(getApprovedTimesheets(state).map((t) => t.id));
  return state.timeEntries.filter(
    (e) =>
      approvedIds.has(e.timesheetId) &&
      (projectId ? e.projectId === projectId : true)
  );
}

export function getPendingTimeEntries(
  state: AppState,
  projectId?: string
): TimeEntry[] {
  const pendingIds = new Set(
    state.timesheets
      .filter((t) => t.status === "submitted")
      .map((t) => t.id)
  );
  return state.timeEntries.filter(
    (e) =>
      pendingIds.has(e.timesheetId) &&
      (projectId ? e.projectId === projectId : true)
  );
}

export function getApprovedExpenses(
  state: AppState,
  projectId?: string
): Expense[] {
  return state.expenses.filter(
    (e) =>
      e.status === "approved" &&
      (projectId ? e.projectId === projectId : true)
  );
}

export function getApprovedLaborCost(
  state: AppState,
  projectId: string
): number {
  const entries = getApprovedTimeEntries(state, projectId);
  return entries.reduce((sum, entry) => {
    const ts = state.timesheets.find((t) => t.id === entry.timesheetId);
    if (!ts) return sum;
    const { costRateCents } = getAssignmentRate(
      state,
      entry.projectId,
      ts.employeeId
    );
    return sum + Math.round(entry.hours * costRateCents);
  }, 0);
}

export function getPendingLaborCost(
  state: AppState,
  projectId: string
): number {
  const entries = getPendingTimeEntries(state, projectId);
  return entries.reduce((sum, entry) => {
    const ts = state.timesheets.find((t) => t.id === entry.timesheetId);
    if (!ts) return sum;
    const { costRateCents } = getAssignmentRate(
      state,
      entry.projectId,
      ts.employeeId
    );
    return sum + Math.round(entry.hours * costRateCents);
  }, 0);
}

export function getApprovedExpenseCost(
  state: AppState,
  projectId: string
): number {
  return getApprovedExpenses(state, projectId).reduce(
    (sum, e) => sum + e.amountCents,
    0
  );
}

export function getPendingExpenseCost(
  state: AppState,
  projectId: string
): number {
  return state.expenses
    .filter((e) => e.projectId === projectId && e.status === "submitted")
    .reduce((sum, e) => sum + e.amountCents, 0);
}

export interface ProjectCostSummary {
  projectId: string;
  approvedLaborCostCents: number;
  pendingLaborCostCents: number;
  approvedExpenseCostCents: number;
  pendingExpenseCostCents: number;
  totalApprovedCostCents: number;
  totalPendingCostCents: number;
  costBudgetCents: number;
  costBudgetRemainingCents: number;
  costBudgetConsumedRatio: number;
  contractValueCents: number;
  revenueEntitlementCents: number;
  invoicedCents: number;
  reservedCents: number;
  unbilledAuthorizedCents: number;
  projectedMarginCents: number;
  projectedMarginRatio: number;
  /** Documented assumption string for UI */
  projectionAssumption: string;
}

function revenueEntitlement(
  state: AppState,
  project: Project
): { cents: number; assumption: string } {
  if (project.billingModel === "fixed_fee") {
    const milestones = state.milestones.filter(
      (m) => m.projectId === project.id
    );
    const cents = milestones.reduce((sum, m) => {
      if (m.status === "cancelled") return sum;
      return (
        sum + Math.round(m.amountCents * m.authorizedBillablePercent)
      );
    }, 0);
    return {
      cents,
      assumption:
        "Fixed-fee revenue entitlement = sum of milestone amounts × authorized billable percent. Labor does not create invoice lines.",
    };
  }

  if (project.billingModel === "time_and_materials") {
    const entries = getApprovedTimeEntries(state, project.id).filter(
      (e) => e.billable
    );
    const labor = entries.reduce((sum, entry) => {
      const ts = state.timesheets.find((t) => t.id === entry.timesheetId);
      if (!ts) return sum;
      const { billRateCents } = getAssignmentRate(
        state,
        entry.projectId,
        ts.employeeId
      );
      return sum + Math.round(entry.hours * billRateCents);
    }, 0);
    const expenses = getApprovedExpenses(state, project.id)
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + e.amountCents, 0);
    const term = state.billingTerms.find((t) => t.projectId === project.id);
    const markup = term?.expenseMarkupPercent ?? 0;
    const expenseWithMarkup = Math.round(expenses * (1 + markup / 100));
    const raw = labor + expenseWithMarkup;
    const ceiling = project.billingCeilingCents ?? raw;
    return {
      cents: Math.min(raw, ceiling),
      assumption:
        "T&M entitlement = approved billable hours × client bill rate + approved billable expenses (with contractual markup), capped at billing ceiling.",
    };
  }

  // accepted_units
  const units = state.acceptedUnits.filter(
    (u) =>
      u.projectId === project.id &&
      (u.status === "accepted" || u.status === "billed")
  );
  const cents = units.reduce(
    (sum, u) => sum + Math.round(u.quantity * u.unitPriceCents),
    0
  );
  return {
    cents,
    assumption:
      "Unit-price entitlement = accepted (and previously billed) quantity × contractual unit price. Submitted/rejected units are excluded.",
  };
}

export function getInvoicedAndReserved(
  state: AppState,
  projectId: string
): { invoicedCents: number; reservedCents: number } {
  const projectInvoiceIds = new Set(
    state.invoices
      .filter((i) => i.projectId === projectId && i.status !== "void")
      .map((i) => i.id)
  );
  const allocs = activeAllocations(state).filter((a) =>
    projectInvoiceIds.has(a.invoiceId)
  );
  return {
    invoicedCents: allocs
      .filter((a) => a.status === "finalized")
      .reduce((s, a) => s + a.amountCents, 0),
    reservedCents: allocs
      .filter((a) => a.status === "reserved")
      .reduce((s, a) => s + a.amountCents, 0),
  };
}

export function getProjectCostSummary(
  state: AppState,
  projectId: string
): ProjectCostSummary | null {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return null;

  const approvedLaborCostCents = getApprovedLaborCost(state, projectId);
  const pendingLaborCostCents = getPendingLaborCost(state, projectId);
  const approvedExpenseCostCents = getApprovedExpenseCost(state, projectId);
  const pendingExpenseCostCents = getPendingExpenseCost(state, projectId);
  const totalApprovedCostCents =
    approvedLaborCostCents + approvedExpenseCostCents;
  const totalPendingCostCents =
    pendingLaborCostCents + pendingExpenseCostCents;
  const costBudgetRemainingCents =
    project.costBudgetCents - totalApprovedCostCents;
  const { cents: revenueEntitlementCents, assumption } = revenueEntitlement(
    state,
    project
  );
  const { invoicedCents, reservedCents } = getInvoicedAndReserved(
    state,
    projectId
  );
  const unbilledAuthorizedCents = Math.max(
    0,
    revenueEntitlementCents - invoicedCents - reservedCents
  );
  // Projected margin uses approved actual cost vs revenue entitlement
  const projectedMarginCents =
    revenueEntitlementCents - totalApprovedCostCents;
  const projectedMarginRatio =
    revenueEntitlementCents > 0
      ? projectedMarginCents / revenueEntitlementCents
      : 0;

  return {
    projectId,
    approvedLaborCostCents,
    pendingLaborCostCents,
    approvedExpenseCostCents,
    pendingExpenseCostCents,
    totalApprovedCostCents,
    totalPendingCostCents,
    costBudgetCents: project.costBudgetCents,
    costBudgetRemainingCents,
    costBudgetConsumedRatio:
      project.costBudgetCents > 0
        ? totalApprovedCostCents / project.costBudgetCents
        : 0,
    contractValueCents: project.contractValueCents,
    revenueEntitlementCents,
    invoicedCents,
    reservedCents,
    unbilledAuthorizedCents,
    projectedMarginCents,
    projectedMarginRatio,
    projectionAssumption: assumption,
  };
}

export interface DashboardKpis {
  activeProjects: number;
  totalAuthorizedBudgetCents: number;
  actualCostToDateCents: number;
  remainingBudgetCents: number;
  projectedMarginCents: number;
  unapprovedTimesheets: number;
  pendingExpenses: number;
  approvedWorkReadyToBillCents: number;
  invoicesInDraft: number;
  utilizationByProject: {
    projectId: string;
    code: string;
    name: string;
    consumedRatio: number;
    approvedCostCents: number;
    budgetCents: number;
  }[];
  revenueVsCost: {
    projectId: string;
    code: string;
    revenueCents: number;
    costCents: number;
  }[];
  attentionItems: {
    id: string;
    severity: "high" | "medium" | "low";
    title: string;
    detail: string;
    href: string;
  }[];
}

export function getDashboardKpis(state: AppState): DashboardKpis {
  const active = state.projects.filter(
    (p) => p.status === "active" || p.status === "planning"
  );
  const summaries = active
    .map((p) => getProjectCostSummary(state, p.id))
    .filter((s): s is ProjectCostSummary => s !== null);

  const totalAuthorizedBudgetCents = active.reduce(
    (s, p) => s + p.costBudgetCents,
    0
  );
  const actualCostToDateCents = summaries.reduce(
    (s, x) => s + x.totalApprovedCostCents,
    0
  );
  const remainingBudgetCents =
    totalAuthorizedBudgetCents - actualCostToDateCents;
  const projectedMarginCents = summaries.reduce(
    (s, x) => s + x.projectedMarginCents,
    0
  );
  const approvedWorkReadyToBillCents = summaries.reduce(
    (s, x) => s + x.unbilledAuthorizedCents,
    0
  );

  const attentionItems: DashboardKpis["attentionItems"] = [];

  const unapprovedTimesheets = state.timesheets.filter(
    (t) => t.status === "submitted"
  ).length;
  const pendingExpenses = state.expenses.filter(
    (e) => e.status === "submitted"
  ).length;

  if (unapprovedTimesheets > 0) {
    attentionItems.push({
      id: "attn-ts",
      severity: "high",
      title: `${unapprovedTimesheets} timesheet(s) awaiting approval`,
      detail: "Submitted time is not yet reflected in approved job cost.",
      href: "/approvals",
    });
  }
  if (pendingExpenses > 0) {
    attentionItems.push({
      id: "attn-exp",
      severity: "medium",
      title: `${pendingExpenses} expense(s) pending review`,
      detail: "Unapproved expenses cannot be invoiced.",
      href: "/approvals",
    });
  }
  for (const s of summaries) {
    if (s.costBudgetConsumedRatio >= 0.9) {
      const project = state.projects.find((p) => p.id === s.projectId)!;
      attentionItems.push({
        id: `attn-budget-${s.projectId}`,
        severity: s.costBudgetConsumedRatio >= 1 ? "high" : "medium",
        title: `${project.code} cost budget ${Math.round(s.costBudgetConsumedRatio * 100)}% consumed`,
        detail: "Review remaining scope and burn rate.",
        href: `/projects/${s.projectId}`,
      });
    }
    if (s.unbilledAuthorizedCents > 0) {
      const project = state.projects.find((p) => p.id === s.projectId)!;
      attentionItems.push({
        id: `attn-bill-${s.projectId}`,
        severity: "low",
        title: `${project.code} has unbilled authorized work`,
        detail: "Eligible items are available for invoice drafting.",
        href: "/billing",
      });
    }
  }

  return {
    activeProjects: active.length,
    totalAuthorizedBudgetCents,
    actualCostToDateCents,
    remainingBudgetCents,
    projectedMarginCents,
    unapprovedTimesheets,
    pendingExpenses,
    approvedWorkReadyToBillCents,
    invoicesInDraft: state.invoices.filter((i) => i.status === "draft")
      .length,
    utilizationByProject: summaries.map((s) => {
      const p = state.projects.find((x) => x.id === s.projectId)!;
      return {
        projectId: s.projectId,
        code: p.code,
        name: p.name,
        consumedRatio: s.costBudgetConsumedRatio,
        approvedCostCents: s.totalApprovedCostCents,
        budgetCents: s.costBudgetCents,
      };
    }),
    revenueVsCost: summaries.map((s) => {
      const p = state.projects.find((x) => x.id === s.projectId)!;
      return {
        projectId: s.projectId,
        code: p.code,
        revenueCents: s.revenueEntitlementCents,
        costCents: s.totalApprovedCostCents,
      };
    }),
    attentionItems,
  };
}

export function laborBreakdownByEmployee(
  state: AppState,
  projectId: string
): { employeeId: string; name: string; hours: number; costCents: number }[] {
  const map = new Map<
    string,
    { employeeId: string; name: string; hours: number; costCents: number }
  >();
  for (const entry of getApprovedTimeEntries(state, projectId)) {
    const ts = state.timesheets.find((t) => t.id === entry.timesheetId);
    if (!ts) continue;
    const emp = state.employees.find((e) => e.id === ts.employeeId);
    const { costRateCents } = getAssignmentRate(
      state,
      projectId,
      ts.employeeId
    );
    const existing = map.get(ts.employeeId) ?? {
      employeeId: ts.employeeId,
      name: emp?.name ?? ts.employeeId,
      hours: 0,
      costCents: 0,
    };
    existing.hours += entry.hours;
    existing.costCents += Math.round(entry.hours * costRateCents);
    map.set(ts.employeeId, existing);
  }
  return Array.from(map.values());
}

export function laborBreakdownByTask(
  state: AppState,
  projectId: string
): { taskId: string; name: string; hours: number; costCents: number }[] {
  const map = new Map<
    string,
    { taskId: string; name: string; hours: number; costCents: number }
  >();
  for (const entry of getApprovedTimeEntries(state, projectId)) {
    const ts = state.timesheets.find((t) => t.id === entry.timesheetId);
    if (!ts) continue;
    const task = state.tasks.find((t) => t.id === entry.taskId);
    const { costRateCents } = getAssignmentRate(
      state,
      projectId,
      ts.employeeId
    );
    const existing = map.get(entry.taskId) ?? {
      taskId: entry.taskId,
      name: task?.name ?? entry.taskId,
      hours: 0,
      costCents: 0,
    };
    existing.hours += entry.hours;
    existing.costCents += Math.round(entry.hours * costRateCents);
    map.set(entry.taskId, existing);
  }
  return Array.from(map.values());
}
