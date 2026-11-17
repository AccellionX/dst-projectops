"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  FileText,
  FolderKanban,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardKpis } from "@/lib/domain/costing";
import { formatDateTime, formatPercent, formatUsd } from "@/lib/format";
import { useAppStore } from "@/store/use-app-store";
import { StatusBadge } from "@/components/shared/status-badge";

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-1 truncate text-xl font-semibold text-slate-900">
            {value}
          </div>
          {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewPage() {
  const state = useAppStore();
  const kpis = getDashboardKpis(state);
  const recent = [...state.auditEvents]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8);

  const utilData = kpis.utilizationByProject.map((p) => ({
    code: p.code.replace(/-2026-/, "-"),
    utilization: Math.round(p.consumedRatio * 100),
    budget: p.budgetCents / 100,
    actual: p.approvedCostCents / 100,
  }));

  const revCost = kpis.revenueVsCost.map((p) => ({
    code: p.code.replace(/-2026-/, "-"),
    revenue: p.revenueCents / 100,
    cost: p.costCents / 100,
  }));

  return (
    <div>
      <PageHeader
        title="Operations Overview"
        description="KPIs derived from live demo state — approved costs, pending approvals, and billing eligibility."
      />

      <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <strong>Concept Demo • Synthetic Data.</strong> Figures use fictional
        clients, rates, and budgets. No live accounting integration.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Active projects"
          value={String(kpis.activeProjects)}
          icon={FolderKanban}
        />
        <Kpi
          label="Authorized cost budget"
          value={formatUsd(kpis.totalAuthorizedBudgetCents)}
          hint={`Remaining ${formatUsd(kpis.remainingBudgetCents)}`}
          icon={CircleDollarSign}
        />
        <Kpi
          label="Actual cost to date"
          value={formatUsd(kpis.actualCostToDateCents)}
          hint="Approved labor + expenses only"
          icon={ClipboardCheck}
        />
        <Kpi
          label="Projected margin"
          value={formatUsd(kpis.projectedMarginCents)}
          hint="Revenue entitlement − approved cost"
          icon={TrendingUp}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Unapproved timesheets"
          value={String(kpis.unapprovedTimesheets)}
          icon={Clock}
        />
        <Kpi
          label="Pending expenses"
          value={String(kpis.pendingExpenses)}
          icon={AlertTriangle}
        />
        <Kpi
          label="Ready to bill"
          value={formatUsd(kpis.approvedWorkReadyToBillCents)}
          hint="Unbilled authorized entitlement"
          icon={FileText}
        />
        <Kpi
          label="Invoices in draft"
          value={String(kpis.invoicesInDraft)}
          icon={FileText}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Budget utilization (approved cost)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Bar dataKey="utilization" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue entitlement vs approved cost</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revCost}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) =>
                    formatUsd(Math.round(Number(v) * 100))
                  }
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#3b6ea8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name="Cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Project health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kpis.utilizationByProject.map((p) => (
              <div
                key={p.projectId}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/projects/${p.projectId}`}
                    className="text-sm font-medium text-navy-800 hover:underline"
                  >
                    {p.code}
                  </Link>
                  <div className="truncate text-xs text-slate-500">{p.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {formatPercent(p.consumedRatio)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatUsd(p.approvedCostCents)} / {formatUsd(p.budgetCents)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attention required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {kpis.attentionItems.length === 0 ? (
              <p className="text-sm text-slate-500">No items need attention.</p>
            ) : (
              kpis.attentionItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50"
                >
                  <Badge
                    variant={
                      item.severity === "high"
                        ? "danger"
                        : item.severity === "medium"
                          ? "warning"
                          : "info"
                    }
                  >
                    {item.severity}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-500">{item.detail}</div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="pb-2 pr-3 font-medium">When</th>
                  <th className="pb-2 pr-3 font-medium">Actor</th>
                  <th className="pb-2 pr-3 font-medium">Action</th>
                  <th className="pb-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => {
                  const actor = state.employees.find((x) => x.id === e.actorId);
                  return (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-slate-500">
                        {formatDateTime(e.timestamp)}
                      </td>
                      <td className="py-2.5 pr-3">{actor?.name ?? e.actorId}</td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={e.action} />
                      </td>
                      <td className="py-2.5">{e.summary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
