"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatHours, formatUsd } from "@/lib/format";
import { canApproveForProject } from "@/lib/permissions";
import { useAppStore } from "@/store/use-app-store";
import type { ApprovalDecision } from "@/types";

export function ApprovalsPage() {
  const state = useAppStore();
  const decideOnTimesheet = useAppStore((s) => s.decideOnTimesheet);
  const decideOnExpense = useAppStore((s) => s.decideOnExpense);

  const allowed =
    state.currentRole === "administrator" ||
    state.currentRole === "project_manager";

  const [pending, setPending] = useState<{
    type: "timesheet" | "expense";
    id: string;
    decision: ApprovalDecision;
  } | null>(null);
  const [comment, setComment] = useState("");

  if (!allowed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Approvals require Project Manager or Administrator simulation. Switch
        role in the top bar.
      </div>
    );
  }

  const timesheets = state.timesheets.filter((t) => {
    if (t.status !== "submitted") return false;
    const entries = state.timeEntries.filter((e) => e.timesheetId === t.id);
    return entries.every((e) =>
      canApproveForProject(
        state.currentRole,
        state.currentEmployeeId,
        e.projectId,
        state
      )
    );
  });

  const expenses = state.expenses.filter(
    (e) =>
      e.status === "submitted" &&
      canApproveForProject(
        state.currentRole,
        state.currentEmployeeId,
        e.projectId,
        state
      )
  );

  const confirm = () => {
    if (!pending) return;
    if (
      (pending.decision === "rejected" || pending.decision === "returned") &&
      comment.trim().length < 3
    ) {
      toast.error("Comment required for return/reject.");
      return;
    }
    const result =
      pending.type === "timesheet"
        ? decideOnTimesheet(pending.id, pending.decision, comment || null)
        : decideOnExpense(pending.id, pending.decision, comment || null);
    if (result.ok) {
      toast.success(`Timesheet/expense ${pending.decision}`);
      setPending(null);
      setComment("");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="PM queue for submitted timesheets and expenses. Approvals immediately update job costing and billing eligibility."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submitted timesheets ({timesheets.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {timesheets.length === 0 ? (
              <p className="text-sm text-slate-500">No timesheets awaiting approval.</p>
            ) : (
              timesheets.map((t) => {
                const emp = state.employees.find((e) => e.id === t.employeeId);
                const entries = state.timeEntries.filter(
                  (e) => e.timesheetId === t.id
                );
                const hours = entries.reduce((s, e) => s + e.hours, 0);
                const projects = Array.from(
                  new Set(
                    entries.map(
                      (e) =>
                        state.projects.find((p) => p.id === e.projectId)?.code ??
                        e.projectId
                    )
                  )
                ).join(", ");
                return (
                  <div
                    key={t.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{emp?.name}</div>
                        <div className="text-xs text-slate-500">
                          Week {t.weekStart} · {formatHours(hours)} · {projects}
                        </div>
                        <div className="text-xs text-slate-500">
                          Submitted{" "}
                          {t.submittedAt ? formatDateTime(t.submittedAt) : "—"}
                        </div>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() =>
                          setPending({
                            type: "timesheet",
                            id: t.id,
                            decision: "approved",
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPending({
                            type: "timesheet",
                            id: t.id,
                            decision: "returned",
                          })
                        }
                      >
                        Return
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setPending({
                            type: "timesheet",
                            id: t.id,
                            decision: "rejected",
                          })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submitted expenses ({expenses.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenses.length === 0 ? (
              <p className="text-sm text-slate-500">No expenses awaiting approval.</p>
            ) : (
              expenses.map((e) => {
                const emp = state.employees.find((x) => x.id === e.employeeId);
                const proj = state.projects.find((p) => p.id === e.projectId);
                return (
                  <div
                    key={e.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{emp?.name}</div>
                        <div className="text-xs text-slate-500">
                          {proj?.code} · {formatUsd(e.amountCents)} ·{" "}
                          {e.description}
                        </div>
                      </div>
                      <StatusBadge status={e.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() =>
                          setPending({
                            type: "expense",
                            id: e.id,
                            decision: "approved",
                          })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPending({
                            type: "expense",
                            id: e.id,
                            decision: "returned",
                          })
                        }
                      >
                        Return
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setPending({
                            type: "expense",
                            id: e.id,
                            decision: "rejected",
                          })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent approval actions</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2">When</th>
                <th className="pb-2">Entity</th>
                <th className="pb-2">Decision</th>
                <th className="pb-2">Comment</th>
              </tr>
            </thead>
            <tbody>
              {[...state.approvalActions]
                .reverse()
                .slice(0, 12)
                .map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="py-2">{formatDateTime(a.createdAt)}</td>
                    <td className="py-2">
                      {a.entityType} · {a.entityId}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={a.decision} />
                    </td>
                    <td className="py-2">{a.comment ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Confirm {pending?.decision} {pending?.type}
            </DialogTitle>
            <DialogDescription>
              This updates costing and billing eligibility immediately in demo
              state.
            </DialogDescription>
          </DialogHeader>
          {(pending?.decision === "rejected" ||
            pending?.decision === "returned") && (
            <div>
              <Label htmlFor="appr-comment">Comment (required)</Label>
              <Textarea
                id="appr-comment"
                className="mt-1"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={confirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
