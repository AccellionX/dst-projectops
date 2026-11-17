"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { appendAudit } from "@/lib/audit";
import {
  decideExpense,
  decideTimesheet,
  reopenTimesheet,
} from "@/lib/domain/approvals";
import { createId } from "@/lib/domain/ids";
import {
  createInvoiceDraft,
  exportInvoice,
  voidInvoiceDraft,
  type AllocationRequest,
} from "@/lib/billing/invoice";
import {
  SEED_VERSION,
  STORAGE_KEY,
  createSeedState,
  isCompatiblePersisted,
} from "@/lib/seed";
import type {
  AppState,
  ApprovalDecision,
  Expense,
  ExpenseCategory,
  Role,
  TimeEntry,
  Timesheet,
} from "@/types";

export interface AppStore extends AppState {
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  switchRole: (employeeId: string) => void;
  resetDemo: () => void;

  saveTimesheetDraft: (input: {
    timesheetId?: string;
    employeeId: string;
    weekStart: string;
    entries: Omit<TimeEntry, "id" | "timesheetId" | "version" | "adjustsEntryId">[];
  }) => { ok: true; timesheetId: string } | { ok: false; error: string };

  submitTimesheet: (
    timesheetId: string
  ) => { ok: true } | { ok: false; error: string };

  decideOnTimesheet: (
    timesheetId: string,
    decision: ApprovalDecision,
    comment: string | null
  ) => { ok: true } | { ok: false; error: string };

  reopenApprovedTimesheet: (
    timesheetId: string,
    reason: string
  ) => { ok: true } | { ok: false; error: string };

  saveExpense: (input: {
    id?: string;
    employeeId: string;
    projectId: string;
    workOrderId: string;
    date: string;
    category: ExpenseCategory;
    description: string;
    amountCents: number;
    billable: boolean;
    reimbursable: boolean;
    receipt?: {
      fileName: string;
      mimeType: string;
      dataUrl: string;
      sizeBytes: number;
    } | null;
  }) => { ok: true; expenseId: string } | { ok: false; error: string };

  submitExpense: (
    expenseId: string
  ) => { ok: true } | { ok: false; error: string };

  decideOnExpense: (
    expenseId: string,
    decision: ApprovalDecision,
    comment: string | null
  ) => { ok: true } | { ok: false; error: string };

  createInvoice: (input: {
    clientId: string;
    projectId: string;
    issueDate: string;
    notes?: string;
    selections: AllocationRequest[];
    idempotencyKey: string;
  }) => { ok: true; invoiceId: string; reused?: boolean } | { ok: false; error: string; code?: string };

  voidInvoice: (
    invoiceId: string
  ) => { ok: true } | { ok: false; error: string };

  exportInvoiceDraft: (
    invoiceId: string,
    exportKey: string
  ) => { ok: true; reused?: boolean } | { ok: false; error: string };

  acceptUnit: (
    unitId: string
  ) => { ok: true } | { ok: false; error: string };

  updateProjectStatus: (
    projectId: string,
    status: AppState["projects"][number]["status"]
  ) => { ok: true } | { ok: false; error: string };
}

function pushAudit(
  state: AppState,
  partial: Parameters<typeof appendAudit>[1]
): AppState {
  return {
    ...state,
    auditEvents: [appendAudit(state, partial), ...state.auditEvents],
  };
}

const seed = createSeedState();

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...seed,
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),

      switchRole: (employeeId) => {
        const emp = get().employees.find((e) => e.id === employeeId);
        if (!emp) return;
        set((s) =>
          pushAudit(
            {
              ...s,
              currentEmployeeId: emp.id,
              currentRole: emp.role,
            },
            {
              actorId: emp.id,
              actorRole: emp.role,
              entityType: "session",
              entityId: emp.id,
              action: "role_switch",
              summary: `Switched simulated role to ${emp.role} (${emp.name})`,
              after: { role: emp.role, employeeId: emp.id },
            }
          )
        );
      },

      resetDemo: () => {
        const fresh = createSeedState();
        set({
          ...fresh,
          hydrated: true,
          auditEvents: [
            appendAudit(fresh, {
              actorId: "emp-admin",
              actorRole: "administrator",
              entityType: "demo",
              entityId: "seed",
              action: "reset",
              summary: "Demo data reset to deterministic seed",
            }),
            ...fresh.auditEvents,
          ],
        });
      },

      saveTimesheetDraft: (input) => {
        const state = get();
        const now = new Date().toISOString();

        // Validate hours
        for (const e of input.entries) {
          if (e.hours < 0 || e.hours > 24) {
            return { ok: false, error: "Hours must be between 0 and 24 per day." };
          }
          const assigned = state.assignments.some(
            (a) =>
              a.employeeId === input.employeeId &&
              a.projectId === e.projectId &&
              a.active
          );
          if (!assigned && state.currentRole !== "administrator") {
            return {
              ok: false,
              error: `Employee is not assigned to project ${e.projectId}.`,
            };
          }
        }

        // Duplicate line check: same project+wo+task+date
        const keys = new Set<string>();
        for (const e of input.entries) {
          const k = `${e.projectId}|${e.workOrderId}|${e.taskId}|${e.date}`;
          if (keys.has(k)) {
            return {
              ok: false,
              error: "Duplicate time lines for the same task and date are not allowed.",
            };
          }
          keys.add(k);
        }

        let timesheetId = input.timesheetId;
        let timesheets = [...state.timesheets];
        let timeEntries = [...state.timeEntries];

        if (timesheetId) {
          const existing = timesheets.find((t) => t.id === timesheetId);
          if (!existing) return { ok: false, error: "Timesheet not found." };
          if (
            existing.status === "approved" ||
            existing.status === "submitted"
          ) {
            return {
              ok: false,
              error: "Cannot edit submitted or approved timesheets.",
            };
          }
          timesheets = timesheets.map((t) =>
            t.id === timesheetId
              ? { ...t, updatedAt: now, status: "draft" as const }
              : t
          );
          timeEntries = timeEntries.filter((e) => e.timesheetId !== timesheetId);
        } else {
          timesheetId = createId("ts");
          const sheet: Timesheet = {
            id: timesheetId,
            employeeId: input.employeeId,
            weekStart: input.weekStart,
            status: "draft",
            submittedAt: null,
            approvedAt: null,
            approvedById: null,
            rejectionReason: null,
            version: 1,
            createdAt: now,
            updatedAt: now,
          };
          timesheets.push(sheet);
        }

        const newEntries: TimeEntry[] = input.entries.map((e) => ({
          ...e,
          id: createId("te"),
          timesheetId: timesheetId!,
          version: 1,
          adjustsEntryId: null,
        }));

        let next: AppState = {
          ...state,
          timesheets,
          timeEntries: [...timeEntries, ...newEntries],
        };
        next = pushAudit(next, {
          actorId: state.currentEmployeeId,
          actorRole: state.currentRole,
          entityType: "timesheet",
          entityId: timesheetId!,
          action: "update",
          summary: `Saved timesheet draft for week ${input.weekStart}`,
        });
        set(next);
        return { ok: true, timesheetId: timesheetId! };
      },

      submitTimesheet: (timesheetId) => {
        const state = get();
        const ts = state.timesheets.find((t) => t.id === timesheetId);
        if (!ts) return { ok: false, error: "Timesheet not found." };
        if (ts.status !== "draft" && ts.status !== "returned" && ts.status !== "rejected") {
          return { ok: false, error: "Timesheet is not in a submittable status." };
        }
        const entries = state.timeEntries.filter((e) => e.timesheetId === timesheetId);
        if (entries.length === 0) {
          return { ok: false, error: "Add at least one time entry before submitting." };
        }
        const total = entries.reduce((s, e) => s + e.hours, 0);
        if (total <= 0) {
          return { ok: false, error: "Total hours must be greater than zero." };
        }

        const now = new Date().toISOString();
        let next: AppState = {
          ...state,
          timesheets: state.timesheets.map((t) =>
            t.id === timesheetId
              ? {
                  ...t,
                  status: "submitted" as const,
                  submittedAt: now,
                  updatedAt: now,
                  rejectionReason: null,
                }
              : t
          ),
        };
        next = pushAudit(next, {
          actorId: state.currentEmployeeId,
          actorRole: state.currentRole,
          entityType: "timesheet",
          entityId: timesheetId,
          action: "submit",
          summary: `Submitted timesheet ${timesheetId}`,
          before: { status: ts.status },
          after: { status: "submitted" },
        });
        set(next);
        return { ok: true };
      },

      decideOnTimesheet: (timesheetId, decision, comment) => {
        const state = get();
        const result = decideTimesheet(
          state,
          timesheetId,
          state.currentEmployeeId,
          decision,
          comment
        );
        if (!result.ok) return result;
        const next = pushAudit(result.state, {
          actorId: state.currentEmployeeId,
          actorRole: state.currentRole,
          entityType: "timesheet",
          entityId: timesheetId,
          action:
            decision === "approved"
              ? "approve"
              : decision === "rejected"
                ? "reject"
                : "return",
          summary: `${decision} timesheet ${timesheetId}`,
          reason: comment,
        });
        set(next);
        return { ok: true };
      },

      reopenApprovedTimesheet: (timesheetId, reason) => {
        const state = get();
        const result = reopenTimesheet(
          state,
          timesheetId,
          state.currentEmployeeId,
          reason
        );
        if (!result.ok) return result;
        set(
          pushAudit(result.state, {
            actorId: state.currentEmployeeId,
            actorRole: state.currentRole,
            entityType: "timesheet",
            entityId: timesheetId,
            action: "reopen",
            summary: `Reopened timesheet ${timesheetId}`,
            reason,
          })
        );
        return { ok: true };
      },

      saveExpense: (input) => {
        const state = get();
        const now = new Date().toISOString();
        if (input.amountCents <= 0) {
          return { ok: false, error: "Amount must be greater than zero." };
        }

        let expenseId = input.id;
        let expenses = [...state.expenses];
        let receipts = [...state.receipts];

        if (expenseId) {
          const existing = expenses.find((e) => e.id === expenseId);
          if (!existing) return { ok: false, error: "Expense not found." };
          if (existing.status === "approved" || existing.status === "submitted") {
            return { ok: false, error: "Cannot edit submitted or approved expenses." };
          }
        } else {
          expenseId = createId("exp");
        }

        let receiptId: string | null = null;
        if (input.receipt) {
          receiptId = createId("rcpt");
          receipts = receipts.filter((r) => r.expenseId !== expenseId);
          receipts.push({
            id: receiptId,
            expenseId: expenseId!,
            fileName: input.receipt.fileName,
            mimeType: input.receipt.mimeType,
            dataUrl: input.receipt.dataUrl,
            sizeBytes: input.receipt.sizeBytes,
            uploadedAt: now,
          });
        }

        const base: Expense = {
          id: expenseId!,
          employeeId: input.employeeId,
          projectId: input.projectId,
          workOrderId: input.workOrderId,
          date: input.date,
          category: input.category,
          description: input.description,
          amountCents: input.amountCents,
          billable: input.billable,
          reimbursable: input.reimbursable,
          status: "draft",
          receiptId,
          submittedAt: null,
          approvedAt: null,
          approvedById: null,
          rejectionReason: null,
          createdAt: now,
          updatedAt: now,
        };

        if (input.id) {
          expenses = expenses.map((e) =>
            e.id === expenseId
              ? {
                  ...base,
                  createdAt: e.createdAt,
                  status:
                    e.status === "returned" || e.status === "rejected"
                      ? "draft"
                      : e.status,
                }
              : e
          );
        } else {
          expenses.push(base);
        }

        let next: AppState = { ...state, expenses, receipts };
        next = pushAudit(next, {
          actorId: state.currentEmployeeId,
          actorRole: state.currentRole,
          entityType: "expense",
          entityId: expenseId!,
          action: input.id ? "update" : "create",
          summary: `${input.id ? "Updated" : "Created"} expense draft`,
        });
        set(next);
        return { ok: true, expenseId: expenseId! };
      },

      submitExpense: (expenseId) => {
        const state = get();
        const exp = state.expenses.find((e) => e.id === expenseId);
        if (!exp) return { ok: false, error: "Expense not found." };
        if (exp.status !== "draft" && exp.status !== "returned" && exp.status !== "rejected") {
          return { ok: false, error: "Expense is not submittable." };
        }
        const now = new Date().toISOString();
        let next: AppState = {
          ...state,
          expenses: state.expenses.map((e) =>
            e.id === expenseId
              ? {
                  ...e,
                  status: "submitted" as const,
                  submittedAt: now,
                  updatedAt: now,
                  rejectionReason: null,
                }
              : e
          ),
        };
        next = pushAudit(next, {
          actorId: state.currentEmployeeId,
          actorRole: state.currentRole,
          entityType: "expense",
          entityId: expenseId,
          action: "submit",
          summary: `Submitted expense ${expenseId}`,
        });
        set(next);
        return { ok: true };
      },

      decideOnExpense: (expenseId, decision, comment) => {
        const state = get();
        const result = decideExpense(
          state,
          expenseId,
          state.currentEmployeeId,
          decision,
          comment
        );
        if (!result.ok) return result;
        set(
          pushAudit(result.state, {
            actorId: state.currentEmployeeId,
            actorRole: state.currentRole,
            entityType: "expense",
            entityId: expenseId,
            action:
              decision === "approved"
                ? "approve"
                : decision === "rejected"
                  ? "reject"
                  : "return",
            summary: `${decision} expense ${expenseId}`,
            reason: comment,
          })
        );
        return { ok: true };
      },

      createInvoice: (input) => {
        const state = get();
        if (
          state.currentRole !== "administrator" &&
          state.currentRole !== "accounting"
        ) {
          return { ok: false, error: "Only Accounting or Admin can create invoices." };
        }
        const result = createInvoiceDraft(state, {
          ...input,
          createdById: state.currentEmployeeId,
        });
        if (!result.ok) {
          return { ok: false, error: result.error, code: result.code };
        }
        if (result.reused) {
          return { ok: true, invoiceId: result.invoiceId, reused: true };
        }
        set(
          pushAudit(result.state, {
            actorId: state.currentEmployeeId,
            actorRole: state.currentRole,
            entityType: "invoice",
            entityId: result.invoiceId,
            action: "reserve",
            summary: `Created invoice draft and reserved allocations`,
          })
        );
        return { ok: true, invoiceId: result.invoiceId };
      },

      voidInvoice: (invoiceId) => {
        const state = get();
        const result = voidInvoiceDraft(state, invoiceId);
        if (!result.ok) return { ok: false, error: result.error };
        if (result.reused) return { ok: true };
        set(
          pushAudit(result.state, {
            actorId: state.currentEmployeeId,
            actorRole: state.currentRole,
            entityType: "invoice",
            entityId: invoiceId,
            action: "void",
            summary: `Voided invoice draft and released reservations`,
          })
        );
        return { ok: true };
      },

      exportInvoiceDraft: (invoiceId, exportKey) => {
        const state = get();
        if (
          state.currentRole !== "administrator" &&
          state.currentRole !== "accounting"
        ) {
          return { ok: false, error: "Only Accounting or Admin can export invoices." };
        }
        const result = exportInvoice(state, invoiceId, exportKey);
        if (!result.ok) return { ok: false, error: result.error };
        if (!result.reused) {
          set(
            pushAudit(result.state, {
              actorId: state.currentEmployeeId,
              actorRole: state.currentRole,
              entityType: "invoice",
              entityId: invoiceId,
              action: "export",
              summary: `Exported invoice and finalized allocations`,
            })
          );
        }
        return { ok: true, reused: result.reused };
      },

      acceptUnit: (unitId) => {
        const state = get();
        const unit = state.acceptedUnits.find((u) => u.id === unitId);
        if (!unit) return { ok: false, error: "Unit not found." };
        if (unit.status !== "submitted") {
          return { ok: false, error: "Only submitted units can be accepted." };
        }
        if (
          state.currentRole !== "administrator" &&
          state.currentRole !== "project_manager"
        ) {
          return { ok: false, error: "Only PM or Admin can accept units." };
        }
        const now = new Date().toISOString();
        let next: AppState = {
          ...state,
          acceptedUnits: state.acceptedUnits.map((u) =>
            u.id === unitId
              ? {
                  ...u,
                  status: "accepted" as const,
                  acceptedAt: now,
                  acceptedById: state.currentEmployeeId,
                }
              : u
          ),
        };
        next = pushAudit(next, {
          actorId: state.currentEmployeeId,
          actorRole: state.currentRole,
          entityType: "accepted_unit",
          entityId: unitId,
          action: "approve",
          summary: `Accepted unit ${unit.siteCode}`,
        });
        set(next);
        return { ok: true };
      },

      updateProjectStatus: (projectId, status) => {
        const state = get();
        if (state.currentRole !== "administrator") {
          return { ok: false, error: "Only Admin can change project status." };
        }
        const project = state.projects.find((p) => p.id === projectId);
        if (!project) return { ok: false, error: "Project not found." };
        let next: AppState = {
          ...state,
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, status, updatedAt: new Date().toISOString() }
              : p
          ),
        };
        next = pushAudit(next, {
          actorId: state.currentEmployeeId,
          actorRole: state.currentRole,
          entityType: "project",
          entityId: projectId,
          action: "update",
          summary: `Updated project status to ${status}`,
          before: { status: project.status },
          after: { status },
        });
        set(next);
        return { ok: true };
      },
    }),
    {
      name: STORAGE_KEY,
      version: SEED_VERSION,
      // Avoid SSR/localStorage mismatches; AppShell rehydrates after mount.
      skipHydration: true,
      partialize: (s) => {
        const state: AppState = {
          meta: s.meta,
          clients: s.clients,
          employees: s.employees,
          projects: s.projects,
          workOrders: s.workOrders,
          tasks: s.tasks,
          assignments: s.assignments,
          timesheets: s.timesheets,
          timeEntries: s.timeEntries,
          expenses: s.expenses,
          receipts: s.receipts,
          approvalActions: s.approvalActions,
          budgets: s.budgets,
          billingTerms: s.billingTerms,
          milestones: s.milestones,
          acceptedUnits: s.acceptedUnits,
          invoices: s.invoices,
          invoiceLines: s.invoiceLines,
          allocations: s.allocations,
          auditEvents: s.auditEvents,
          currentEmployeeId: s.currentEmployeeId,
          currentRole: s.currentRole,
        };
        return state;
      },
      migrate: (persisted, version) => {
        if (!isCompatiblePersisted(version)) {
          return createSeedState() as unknown as AppStore;
        }
        return persisted as AppStore;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

export function useCurrentEmployee() {
  return useAppStore((s) =>
    s.employees.find((e) => e.id === s.currentEmployeeId)
  );
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    administrator: "Administrator",
    project_manager: "Project Manager",
    engineer: "Engineer",
    accounting: "Accounting",
  };
  return labels[role];
}
