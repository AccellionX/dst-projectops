"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getProjectCostSummary,
  laborBreakdownByEmployee,
  laborBreakdownByTask,
} from "@/lib/domain/costing";
import { formatDate, formatHours, formatUsd, titleCase } from "@/lib/format";
import { canAccessProject, canManageProjects } from "@/lib/permissions";
import { useAppStore } from "@/store/use-app-store";
import { toast } from "sonner";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const state = useAppStore();
  const updateProjectStatus = useAppStore((s) => s.updateProjectStatus);
  const project = state.projects.find((p) => p.id === projectId);

  if (!project) notFound();

  if (
    !canAccessProject(
      state.currentRole,
      state.currentEmployeeId,
      projectId,
      state
    )
  ) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Your simulated role cannot access this project. Switch role in the top bar.
      </div>
    );
  }

  const client = state.clients.find((c) => c.id === project.clientId);
  const pm = state.employees.find((e) => e.id === project.pmEmployeeId);
  const summary = getProjectCostSummary(state, projectId)!;
  const workOrders = state.workOrders.filter((w) => w.projectId === projectId);
  const team = state.assignments.filter(
    (a) => a.projectId === projectId && a.active
  );
  const milestones = state.milestones
    .filter((m) => m.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const units = state.acceptedUnits.filter((u) => u.projectId === projectId);
  const byEmp = laborBreakdownByEmployee(state, projectId);
  const byTask = laborBreakdownByTask(state, projectId);
  const audit = state.auditEvents
    .filter((e) => e.entityId === projectId || e.summary.includes(project.code))
    .slice(0, 10);

  return (
    <div>
      <PageHeader
        title={project.name}
        description={`${project.code} · ${client?.name ?? "Client"} · PM ${pm?.name ?? "—"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/projects">Back</Link>
            </Button>
            {canManageProjects(state.currentRole) && project.status === "active" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  const r = updateProjectStatus(projectId, "on_hold");
                  if (r.ok) toast.success("Project placed on hold");
                  else toast.error(r.error);
                }}
              >
                Place on hold
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge status={project.status} />
        <StatusBadge status={project.billingModel} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-slate-500">Contract value</div>
            <div className="mt-1 text-xl font-semibold">
              {formatUsd(project.contractValueCents)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-slate-500">Cost budget</div>
            <div className="mt-1 text-xl font-semibold">
              {formatUsd(project.costBudgetCents)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-slate-500">Approved actual cost</div>
            <div className="mt-1 text-xl font-semibold">
              {formatUsd(summary.totalApprovedCostCents)}
            </div>
            <div className="text-xs text-slate-500">
              Pending {formatUsd(summary.totalPendingCostCents)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase text-slate-500">Unbilled authorized</div>
            <div className="mt-1 text-xl font-semibold">
              {formatUsd(summary.unbilledAuthorizedCents)}
            </div>
            <div className="text-xs text-slate-500">
              Invoiced {formatUsd(summary.invoicedCents)} · Reserved{" "}
              {formatUsd(summary.reservedCents)}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-3 text-xs text-slate-500">{summary.projectionAssumption}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Work orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {workOrders.map((wo) => (
              <div
                key={wo.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">
                    {wo.number} · {wo.title}
                  </div>
                  <div className="text-xs text-slate-500">{wo.description}</div>
                </div>
                <StatusBadge status={wo.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team assignments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {team.map((a) => {
              const emp = state.employees.find((e) => e.id === a.employeeId);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{emp?.name}</div>
                    <div className="text-xs text-slate-500">{a.roleLabel}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>Cost {formatUsd(a.costRateCents)}/h</div>
                    {a.billRateCents > 0 ? (
                      <div>Bill {formatUsd(a.billRateCents)}/h</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {project.billingModel === "fixed_fee" && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Code</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Authorized %</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="py-2">{m.code}</td>
                    <td className="py-2">{m.name}</td>
                    <td className="py-2">{formatUsd(m.amountCents)}</td>
                    <td className="py-2">
                      {Math.round(m.authorizedBillablePercent * 100)}%
                    </td>
                    <td className="py-2">
                      <StatusBadge status={m.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {project.billingModel === "accepted_units" && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Accepted units</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Site</th>
                  <th className="pb-2">Description</th>
                  <th className="pb-2">Qty</th>
                  <th className="pb-2">Unit price</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="py-2">{u.siteCode}</td>
                    <td className="py-2">{u.description}</td>
                    <td className="py-2">{u.quantity}</td>
                    <td className="py-2">{formatUsd(u.unitPriceCents)}</td>
                    <td className="py-2">
                      <StatusBadge status={u.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Labor by employee (approved)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {byEmp.length === 0 ? (
              <p className="text-slate-500">No approved labor yet.</p>
            ) : (
              byEmp.map((r) => (
                <div key={r.employeeId} className="flex justify-between">
                  <span>{r.name}</span>
                  <span>
                    {formatHours(r.hours)} · {formatUsd(r.costCents)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Labor by task (approved)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {byTask.length === 0 ? (
              <p className="text-slate-500">No approved labor yet.</p>
            ) : (
              byTask.map((r) => (
                <div key={r.taskId} className="flex justify-between">
                  <span>{r.name}</span>
                  <span>
                    {formatHours(r.hours)} · {formatUsd(r.costCents)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Dates & description</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <p>
            {formatDate(project.startDate)}
            {project.endDate ? ` → ${formatDate(project.endDate)}` : ""}
          </p>
          <p className="mt-2">{project.description}</p>
          {project.billingCeilingCents != null ? (
            <p className="mt-2">
              Billing ceiling: {formatUsd(project.billingCeilingCents)}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            Contract type: {titleCase(project.billingModel)}
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Related audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {audit.length === 0 ? (
            <p className="text-slate-500">No matching audit events.</p>
          ) : (
            audit.map((e) => (
              <div key={e.id} className="flex justify-between gap-3 border-b border-slate-100 py-2">
                <span>{e.summary}</span>
                <StatusBadge status={e.action} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
