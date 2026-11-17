/**
 * Role simulation permissions — NOT production authentication.
 * UI and state actions must call these consistently.
 */
import type { AppState, Role } from "@/types";

export const ROLE_LABELS: Record<Role, string> = {
  administrator: "Administrator",
  project_manager: "Project Manager",
  engineer: "Engineer",
  accounting: "Accounting",
};

export function canViewAllProjects(role: Role): boolean {
  return role === "administrator" || role === "accounting";
}

export function canManageProjects(role: Role): boolean {
  return role === "administrator";
}

export function canViewJobCosting(role: Role): boolean {
  return (
    role === "administrator" ||
    role === "project_manager" ||
    role === "accounting"
  );
}

export function canViewAudit(role: Role): boolean {
  return role === "administrator" || role === "accounting";
}

export function canResetDemo(role: Role): boolean {
  return role === "administrator";
}

export function canCreateInvoice(role: Role): boolean {
  return role === "administrator" || role === "accounting";
}

export function canExportInvoice(role: Role): boolean {
  return role === "administrator" || role === "accounting";
}

export function canApproveForProject(
  role: Role,
  employeeId: string,
  projectId: string,
  state: AppState
): boolean {
  if (role === "administrator") return true;
  if (role !== "project_manager") return false;
  const project = state.projects.find((p) => p.id === projectId);
  return project?.pmEmployeeId === employeeId;
}

export function canSubmitTimesheet(
  role: Role,
  actorId: string,
  timesheetEmployeeId: string
): boolean {
  if (role === "administrator") return true;
  if (role === "engineer" || role === "project_manager") {
    return actorId === timesheetEmployeeId;
  }
  return false;
}

export function canEditTimesheet(
  role: Role,
  actorId: string,
  timesheetEmployeeId: string,
  status: string
): boolean {
  if (status === "approved") return false;
  if (role === "administrator") return true;
  if (role === "engineer" || role === "project_manager") {
    return (
      actorId === timesheetEmployeeId &&
      (status === "draft" || status === "returned" || status === "rejected")
    );
  }
  return false;
}

export function canSubmitExpense(
  role: Role,
  actorId: string,
  expenseEmployeeId: string
): boolean {
  return canSubmitTimesheet(role, actorId, expenseEmployeeId);
}

export function getAccessibleProjectIds(
  role: Role,
  employeeId: string,
  state: AppState
): string[] {
  if (canViewAllProjects(role)) {
    return state.projects.map((p) => p.id);
  }
  if (role === "project_manager") {
    const asPm = state.projects
      .filter((p) => p.pmEmployeeId === employeeId)
      .map((p) => p.id);
    const assigned = state.assignments
      .filter((a) => a.employeeId === employeeId && a.active)
      .map((a) => a.projectId);
    return Array.from(new Set([...asPm, ...assigned]));
  }
  if (role === "engineer") {
    return state.assignments
      .filter((a) => a.employeeId === employeeId && a.active)
      .map((a) => a.projectId);
  }
  return [];
}

export function canAccessProject(
  role: Role,
  employeeId: string,
  projectId: string,
  state: AppState
): boolean {
  return getAccessibleProjectIds(role, employeeId, state).includes(projectId);
}

export function employeesForRole(state: AppState, role: Role) {
  return state.employees.filter((e) => e.role === role && e.active);
}
