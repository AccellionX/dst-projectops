"use client";

import { useMemo, useState } from "react";
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
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format";
import { canViewAudit } from "@/lib/permissions";
import { useAppStore } from "@/store/use-app-store";

export function AuditPage() {
  const state = useAppStore();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const events = useMemo(() => {
    return state.auditEvents
      .filter((e) => (action === "all" ? true : e.action === action))
      .filter((e) =>
        `${e.summary} ${e.entityType} ${e.entityId} ${e.action}`
          .toLowerCase()
          .includes(q.toLowerCase())
      )
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [state.auditEvents, q, action]);

  const event = state.auditEvents.find((e) => e.id === selected);

  if (!canViewAudit(state.currentRole)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Audit trail visibility is limited to Administrator and Accounting
        simulations.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description="Append-only within demo state transitions. Client-side storage is not a production tamper-proof ledger."
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <Input
          className="max-w-md"
          placeholder="Search audit events…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {[
              "create",
              "update",
              "submit",
              "approve",
              "reject",
              "return",
              "reserve",
              "void",
              "export",
              "reopen",
              "reset",
              "role_switch",
            ].map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Summary</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const actor = state.employees.find((x) => x.id === e.actorId);
              return (
                <tr
                  key={e.id}
                  className="cursor-pointer border-t hover:bg-slate-50"
                  onClick={() => setSelected(e.id)}
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {formatDateTime(e.timestamp)}
                  </td>
                  <td className="px-4 py-2.5">{actor?.name ?? e.actorId}</td>
                  <td className="px-4 py-2.5">{e.actorRole}</td>
                  <td className="px-4 py-2.5">
                    {e.entityType}:{e.entityId}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={e.action} />
                  </td>
                  <td className="px-4 py-2.5">{e.summary}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Audit detail</SheetTitle>
          </SheetHeader>
          {event ? (
            <SheetBody className="space-y-3 text-sm">
              <p>{event.summary}</p>
              {event.reason ? (
                <p className="rounded-md bg-amber-50 p-2 text-amber-900">
                  Reason: {event.reason}
                </p>
              ) : null}
              <div>
                <div className="text-xs uppercase text-slate-500">Before</div>
                <pre className="mt-1 overflow-auto rounded bg-slate-100 p-2 text-xs">
                  {JSON.stringify(event.before, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">After</div>
                <pre className="mt-1 overflow-auto rounded bg-slate-100 p-2 text-xs">
                  {JSON.stringify(event.after, null, 2)}
                </pre>
              </div>
            </SheetBody>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
