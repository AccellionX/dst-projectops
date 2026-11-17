"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAccessibleProjectIds } from "@/lib/permissions";
import { useAppStore } from "@/store/use-app-store";

export function WorkOrdersPage() {
  const state = useAppStore();
  const [q, setQ] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");

  const accessible = new Set(
    getAccessibleProjectIds(state.currentRole, state.currentEmployeeId, state)
  );

  const rows = state.workOrders
    .filter((w) => accessible.has(w.projectId))
    .filter((w) =>
      projectFilter === "all" ? true : w.projectId === projectFilter
    )
    .filter((w) =>
      `${w.number} ${w.title} ${w.description}`
        .toLowerCase()
        .includes(q.toLowerCase())
    );

  return (
    <div>
      <PageHeader
        title="Work Orders"
        description="Work packages nested under projects/jobs."
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <Input
          className="max-w-md"
          placeholder="Search work orders…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {state.projects
              .filter((p) => accessible.has(p.id))
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => {
              const project = state.projects.find((p) => p.id === w.projectId);
              const tasks = state.tasks.filter((t) => t.workOrderId === w.id);
              return (
                <tr key={w.id} className="border-t">
                  <td className="px-4 py-2.5 font-medium">{w.number}</td>
                  <td className="px-4 py-2.5">
                    <div>{w.title}</div>
                    <div className="text-xs text-slate-500">{w.description}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/projects/${w.projectId}`}
                      className="text-navy-800 hover:underline"
                    >
                      {project?.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={w.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {tasks.map((t) => t.name).join(", ") || "—"}
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
