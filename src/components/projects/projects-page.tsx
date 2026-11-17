"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProjectCostSummary } from "@/lib/domain/costing";
import { formatUsd, titleCase } from "@/lib/format";
import { getAccessibleProjectIds } from "@/lib/permissions";
import { useAppStore } from "@/store/use-app-store";

export function ProjectsPage() {
  const state = useAppStore();
  const [q, setQ] = useState("");
  const [model, setModel] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const accessible = useMemo(
    () =>
      new Set(
        getAccessibleProjectIds(
          state.currentRole,
          state.currentEmployeeId,
          state
        )
      ),
    [state]
  );

  const rows = state.projects
    .filter((p) => accessible.has(p.id))
    .filter((p) => (model === "all" ? true : p.billingModel === model))
    .filter((p) => (status === "all" ? true : p.status === status))
    .filter((p) => {
      const client = state.clients.find((c) => c.id === p.clientId);
      const hay = `${p.code} ${p.name} ${client?.name ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });

  return (
    <div>
      <PageHeader
        title="Projects & Jobs"
        description="Contract revenue, internal cost budget, and actual approved cost are tracked separately."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search projects or clients…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search projects"
            />
          </div>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-full md:w-48" aria-label="Billing model">
              <SelectValue placeholder="Billing model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All models</SelectItem>
              <SelectItem value="fixed_fee">Fixed fee</SelectItem>
              <SelectItem value="time_and_materials">Time & materials</SelectItem>
              <SelectItem value="accepted_units">Accepted units</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-40" aria-label="Status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Contract</th>
              <th className="px-4 py-3 font-medium text-right">Cost budget</th>
              <th className="px-4 py-3 font-medium text-right">Actual cost</th>
              <th className="px-4 py-3 font-medium text-right">Unbilled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const client = state.clients.find((c) => c.id === p.clientId);
              const summary = getProjectCostSummary(state, p.id);
              return (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-navy-800 hover:underline"
                    >
                      {p.code}
                    </Link>
                    <div className="text-xs text-slate-500">{p.name}</div>
                  </td>
                  <td className="px-4 py-3">{client?.name}</td>
                  <td className="px-4 py-3">{titleCase(p.billingModel)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatUsd(p.contractValueCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatUsd(p.costBudgetCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatUsd(summary?.totalApprovedCostCents ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatUsd(summary?.unbilledAuthorizedCents ?? 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
