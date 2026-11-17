import { createId } from "@/lib/domain/ids";
import { canApproveForProject } from "@/lib/permissions";
import type { AppState, ApprovalDecision, Expense, Timesheet } from "@/types";

export type ApprovalResult =
  | { ok: true; state: AppState }
  | { ok: false; error: string };

export function decideTimesheet(
  state: AppState,
  timesheetId: string,
  actorId: string,
  decision: ApprovalDecision,
  comment: string | null
): ApprovalResult {
  const ts = state.timesheets.find((t) => t.id === timesheetId);
  if (!ts) return { ok: false, error: "Timesheet not found." };
  if (ts.status !== "submitted") {
    return { ok: false, error: "Only submitted timesheets can be reviewed." };
  }

  const entries = state.timeEntries.filter((e) => e.timesheetId === timesheetId);
  const projectIds = Array.from(new Set(entries.map((e) => e.projectId)));
  const actor = state.employees.find((e) => e.id === actorId);
  if (!actor) return { ok: false, error: "Actor not found." };

  for (const pid of projectIds) {
    if (!canApproveForProject(actor.role, actorId, pid, state)) {
      return {
        ok: false,
        error: "You are not authorized to approve for one or more projects on this timesheet.",
      };
    }
  }

  if (
    (decision === "rejected" || decision === "returned") &&
    (!comment || comment.trim().length < 3)
  ) {
    return {
      ok: false,
      error: "A comment is required when returning or rejecting.",
    };
  }

  const now = new Date().toISOString();
  const status: Timesheet["status"] =
    decision === "approved"
      ? "approved"
      : decision === "rejected"
        ? "rejected"
        : "returned";

  const updated: Timesheet = {
    ...ts,
    status,
    approvedAt: decision === "approved" ? now : null,
    approvedById: decision === "approved" ? actorId : null,
    rejectionReason:
      decision === "approved" ? null : (comment?.trim() ?? null),
    updatedAt: now,
  };

  const action = {
    id: createId("appr"),
    entityType: "timesheet" as const,
    entityId: timesheetId,
    actorId,
    decision,
    comment: comment?.trim() ?? null,
    createdAt: now,
  };

  return {
    ok: true,
    state: {
      ...state,
      timesheets: state.timesheets.map((t) =>
        t.id === timesheetId ? updated : t
      ),
      approvalActions: [...state.approvalActions, action],
    },
  };
}

export function decideExpense(
  state: AppState,
  expenseId: string,
  actorId: string,
  decision: ApprovalDecision,
  comment: string | null
): ApprovalResult {
  const expense = state.expenses.find((e) => e.id === expenseId);
  if (!expense) return { ok: false, error: "Expense not found." };
  if (expense.status !== "submitted") {
    return { ok: false, error: "Only submitted expenses can be reviewed." };
  }

  const actor = state.employees.find((e) => e.id === actorId);
  if (!actor) return { ok: false, error: "Actor not found." };

  if (
    !canApproveForProject(actor.role, actorId, expense.projectId, state)
  ) {
    return {
      ok: false,
      error: "You are not authorized to approve expenses for this project.",
    };
  }

  if (
    (decision === "rejected" || decision === "returned") &&
    (!comment || comment.trim().length < 3)
  ) {
    return {
      ok: false,
      error: "A comment is required when returning or rejecting.",
    };
  }

  const now = new Date().toISOString();
  const status: Expense["status"] =
    decision === "approved"
      ? "approved"
      : decision === "rejected"
        ? "rejected"
        : "returned";

  const updated: Expense = {
    ...expense,
    status,
    approvedAt: decision === "approved" ? now : null,
    approvedById: decision === "approved" ? actorId : null,
    rejectionReason:
      decision === "approved" ? null : (comment?.trim() ?? null),
    updatedAt: now,
  };

  const action = {
    id: createId("appr"),
    entityType: "expense" as const,
    entityId: expenseId,
    actorId,
    decision,
    comment: comment?.trim() ?? null,
    createdAt: now,
  };

  return {
    ok: true,
    state: {
      ...state,
      expenses: state.expenses.map((e) =>
        e.id === expenseId ? updated : e
      ),
      approvalActions: [...state.approvalActions, action],
    },
  };
}

export function reopenTimesheet(
  state: AppState,
  timesheetId: string,
  actorId: string,
  reason: string
): ApprovalResult {
  const ts = state.timesheets.find((t) => t.id === timesheetId);
  if (!ts) return { ok: false, error: "Timesheet not found." };
  if (ts.status !== "approved") {
    return { ok: false, error: "Only approved timesheets can be reopened." };
  }
  const actor = state.employees.find((e) => e.id === actorId);
  if (!actor || (actor.role !== "administrator" && actor.role !== "project_manager")) {
    return { ok: false, error: "Insufficient permissions to reopen." };
  }
  if (!reason || reason.trim().length < 3) {
    return { ok: false, error: "Reopen reason is required." };
  }

  // Block reopen if any approved entry is allocated
  const entries = state.timeEntries.filter((e) => e.timesheetId === timesheetId);
  for (const entry of entries) {
    const allocated = state.allocations.some(
      (a) =>
        a.sourceType === "time_entry" &&
        a.sourceId === entry.id &&
        (a.status === "reserved" || a.status === "finalized")
    );
    if (allocated) {
      return {
        ok: false,
        error:
          "Cannot reopen: one or more entries are reserved or finalized on an invoice. Void the draft or create a versioned adjustment instead.",
      };
    }
  }

  const now = new Date().toISOString();
  return {
    ok: true,
    state: {
      ...state,
      timesheets: state.timesheets.map((t) =>
        t.id === timesheetId
          ? {
              ...t,
              status: "draft" as const,
              approvedAt: null,
              approvedById: null,
              rejectionReason: null,
              version: t.version + 1,
              updatedAt: now,
            }
          : t
      ),
    },
  };
}
