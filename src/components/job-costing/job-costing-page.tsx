"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getProjectCostSummary,
  laborBreakdownByEmployee,
  laborBreakdownByTask,
} from "@/lib/domain/costing";
import { formatHours, formatPercent, formatUsd } from "@/lib/format";
import { canViewJobCosting, getAccessibleProjectIds } from "@/lib/permissions";
import { useAppStore } from "@/store/use-app-store";

export function JobCostingPage() {
  const state = useAppStore();
  const projectIds = getAccessibleProjectIds(
    state.currentRole,
    state.currentEmployeeId,
    state
  );
  const projects = state.projects.filter((p) => projectIds.includes(p.id));
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "proj-bess");
  const summary = getProjectCostSummary(state, projectId);
  const byEmp = laborBreakdownByEmployee(state, projectId);
  const byTask = laborBreakdownByTask(state, projectId);
  const workOrders = state.workOrders.filter((w) => w.projectId === projectId);

  if (!canViewJobCosting(state.currentRole)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Job costing is not available for the Engineer simulation. Switch to PM,
        Accounting, or Admin.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Job Costing"
        description="Approved actuals vs pending estimates. Contract revenue, cost budget, and actual cost are distinct."
      />

      <div className="mb-4 max-w-sm">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger aria-label="Select project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.code} — {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!summary ? null : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Approved labor cost"
              value={formatUsd(summary.approvedLaborCostCents)}
              hint={`Pending ${formatUsd(summary.pendingLaborCostCents)}`}
            />
            <Metric
              label="Approved expenses"
              value={formatUsd(summary.approvedExpenseCostCents)}
              hint={`Pending ${formatUsd(summary.pendingExpenseCostCents)}`}
            />
            <Metric
              label="Cost budget remaining"
              value={formatUsd(summary.costBudgetRemainingCents)}
              hint={`${formatPercent(summary.costBudgetConsumedRatio)} consumed`}
            />
            <Metric
              label="Projected margin"
              value={formatUsd(summary.projectedMarginCents)}
              hint={formatPercent(summary.projectedMarginRatio)}
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Revenue entitlement"
              value={formatUsd(summary.revenueEntitlementCents)}
            />
            <Metric label="Invoiced" value={formatUsd(summary.invoicedCents)} />
            <Metric
              label="Reserved in drafts"
              value={formatUsd(summary.reservedCents)}
            />
            <Metric
              label="Unbilled authorized"
              value={formatUsd(summary.unbilledAuthorizedCents)}
            />
          </div>

          <p className="mt-3 text-xs text-slate-500">
            {summary.projectionAssumption}
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>By employee</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {byEmp.map((r) => (
                  <div key={r.employeeId} className="flex justify-between">
                    <span>{r.name}</span>
                    <span>
                      {formatHours(r.hours)} · {formatUsd(r.costCents)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By task</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {byTask.map((r) => (
                  <div key={r.taskId} className="flex justify-between">
                    <span>{r.name}</span>
                    <span>
                      {formatHours(r.hours)} · {formatUsd(r.costCents)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Work orders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {workOrders.map((w) => {
                  const hours = state.timeEntries
                    .filter((e) => {
                      const ts = state.timesheets.find(
                        (t) => t.id === e.timesheetId
                      );
                      return (
                        e.workOrderId === w.id && ts?.status === "approved"
                      );
                    })
                    .reduce((s, e) => s + e.hours, 0);
                  return (
                    <div key={w.id} className="flex justify-between">
                      <span>{w.number}</span>
                      <span>{formatHours(hours)}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold">{value}</div>
        {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}
