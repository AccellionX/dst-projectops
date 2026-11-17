/**
 * DST ProjectOps — domain types
 * Synthetic demo data only. Currency amounts are integer USD cents.
 */

export type Role =
  | "administrator"
  | "project_manager"
  | "engineer"
  | "accounting";

export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "closed";

export type BillingModel =
  | "fixed_fee"
  | "time_and_materials"
  | "accepted_units";

export type WorkOrderStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled";

export type TimesheetStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "returned";

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "returned";

export type ExpenseCategory =
  | "travel"
  | "lodging"
  | "meals"
  | "equipment"
  | "software"
  | "subcontractor"
  | "other";

export type MilestoneStatus =
  | "pending"
  | "in_progress"
  | "ready_to_bill"
  | "partially_billed"
  | "fully_billed"
  | "cancelled";

export type AcceptedUnitStatus =
  | "submitted"
  | "accepted"
  | "rejected"
  | "billed";

export type InvoiceStatus =
  | "draft"
  | "exported"
  | "void";

export type AllocationStatus =
  | "reserved"
  | "finalized"
  | "released";

export type AllocationSourceType =
  | "time_entry"
  | "expense"
  | "milestone"
  | "accepted_unit";

export type ApprovalEntityType = "timesheet" | "expense";

export type ApprovalDecision =
  | "approved"
  | "rejected"
  | "returned";

export type AuditAction =
  | "create"
  | "update"
  | "submit"
  | "approve"
  | "reject"
  | "return"
  | "reopen"
  | "void"
  | "export"
  | "reserve"
  | "release"
  | "reset"
  | "role_switch";

export interface Client {
  id: string;
  code: string;
  name: string;
  industry: string;
  primaryContact: string;
  email: string;
  phone: string;
  billingAddress: string;
  paymentTermsDays: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  title: string;
  role: Role;
  department: string;
  /** Internal cost rate in cents per hour */
  defaultCostRateCents: number;
  active: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  clientId: string;
  pmEmployeeId: string;
  billingModel: BillingModel;
  status: ProjectStatus;
  /** Authorized / contract revenue value in cents */
  contractValueCents: number;
  /** Internal job cost budget in cents (labor + expense plan) */
  costBudgetCents: number;
  /** T&M billing ceiling; null for non-T&M */
  billingCeilingCents: number | null;
  startDate: string;
  endDate: string | null;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrder {
  id: string;
  projectId: string;
  number: string;
  title: string;
  status: WorkOrderStatus;
  description: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  workOrderId: string;
  code: string;
  name: string;
  billableDefault: boolean;
  active: boolean;
}

export interface ProjectAssignment {
  id: string;
  projectId: string;
  employeeId: string;
  roleLabel: string;
  /** Internal cost rate override in cents/hour */
  costRateCents: number;
  /** Client bill rate in cents/hour (T&M) */
  billRateCents: number;
  startDate: string;
  endDate: string | null;
  active: boolean;
}

export interface TimeEntry {
  id: string;
  timesheetId: string;
  projectId: string;
  workOrderId: string;
  taskId: string;
  date: string;
  hours: number;
  billable: boolean;
  notes: string;
  /** Version for corrections; original = 1 */
  version: number;
  /** Links adjustment to prior entry */
  adjustsEntryId: string | null;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  weekStart: string;
  status: TimesheetStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  rejectionReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  expenseId: string;
  fileName: string;
  mimeType: string;
  /** Browser-local data URL; demo-only persistence */
  dataUrl: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface Expense {
  id: string;
  employeeId: string;
  projectId: string;
  workOrderId: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  /** Amount in cents */
  amountCents: number;
  billable: boolean;
  /** Reimbursable to employee */
  reimbursable: boolean;
  status: ExpenseStatus;
  receiptId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedById: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalAction {
  id: string;
  entityType: ApprovalEntityType;
  entityId: string;
  actorId: string;
  decision: ApprovalDecision;
  comment: string | null;
  createdAt: string;
}

export interface Budget {
  id: string;
  projectId: string;
  laborBudgetCents: number;
  expenseBudgetCents: number;
  contingencyCents: number;
  notes: string;
}

export interface BillingTerm {
  id: string;
  projectId: string;
  model: BillingModel;
  /** Fixed fee total or unit price, depending on model */
  amountCents: number;
  unitLabel: string | null;
  plannedUnits: number | null;
  allowPartialMilestoneBilling: boolean;
  expenseMarkupPercent: number;
  notes: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description: string;
  /** Contracted fee for this milestone in cents */
  amountCents: number;
  status: MilestoneStatus;
  /** Fraction 0–1 of amount already authorized for billing */
  authorizedBillablePercent: number;
  dueDate: string;
  completedAt: string | null;
  sortOrder: number;
}

export interface AcceptedUnit {
  id: string;
  projectId: string;
  workOrderId: string;
  siteCode: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  status: AcceptedUnitStatus;
  submittedAt: string;
  acceptedAt: string | null;
  acceptedById: string | null;
  notes: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  sourceType: AllocationSourceType;
  sourceId: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  allocationId: string;
}

export interface InvoiceDraft {
  id: string;
  number: string;
  clientId: string;
  projectId: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  notes: string;
  createdById: string;
  exportedAt: string | null;
  voidedAt: string | null;
  /** Idempotency key for create/export actions */
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Deterministic billing allocation ledger entry.
 * Draft invoices reserve; void releases; export finalizes.
 */
export interface BillingAllocation {
  id: string;
  invoiceId: string;
  sourceType: AllocationSourceType;
  sourceId: string;
  /** Quantity allocated (hours, units, or 1 for lump amounts) */
  quantity: number;
  /** Amount allocated in cents */
  amountCents: number;
  status: AllocationStatus;
  createdAt: string;
  releasedAt: string | null;
  finalizedAt: string | null;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorRole: Role;
  timestamp: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
}

export interface DemoMeta {
  seedVersion: number;
  label: string;
  disclaimer: string;
}

export interface AppState {
  meta: DemoMeta;
  clients: Client[];
  employees: Employee[];
  projects: Project[];
  workOrders: WorkOrder[];
  tasks: Task[];
  assignments: ProjectAssignment[];
  timesheets: Timesheet[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  receipts: Receipt[];
  approvalActions: ApprovalAction[];
  budgets: Budget[];
  billingTerms: BillingTerm[];
  milestones: Milestone[];
  acceptedUnits: AcceptedUnit[];
  invoices: InvoiceDraft[];
  invoiceLines: InvoiceLine[];
  allocations: BillingAllocation[];
  auditEvents: AuditEvent[];
  /** Simulated current actor (not production auth) */
  currentEmployeeId: string;
  currentRole: Role;
}

export type PersistedStore = {
  version: number;
  state: AppState;
};
