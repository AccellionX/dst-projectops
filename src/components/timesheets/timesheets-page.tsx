"use client";

import { useMemo, useState } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatHours } from "@/lib/format";
import {
  canEditTimesheet,
  canSubmitTimesheet,
  getAccessibleProjectIds,
} from "@/lib/permissions";
import { useAppStore } from "@/store/use-app-store";
import type { AppState, Project, TimeEntry, WorkOrder, Task } from "@/types";

type DraftLine = {
  key: string;
  projectId: string;
  workOrderId: string;
  taskId: string;
  date: string;
  hours: string;
  billable: boolean;
  notes: string;
};

function weekDates(weekStart: string) {
  const start = parseISO(weekStart);
  return Array.from({ length: 5 }, (_, i) =>
    format(addDays(start, i), "yyyy-MM-dd")
  );
}

function entriesToLines(entries: TimeEntry[]): DraftLine[] {
  return entries.map((e) => ({
    key: e.id,
    projectId: e.projectId,
    workOrderId: e.workOrderId,
    taskId: e.taskId,
    date: e.date,
    hours: String(e.hours),
    billable: e.billable,
    notes: e.notes,
  }));
}

export function TimesheetsPage() {
  const state = useAppStore();
  const saveTimesheetDraft = useAppStore((s) => s.saveTimesheetDraft);
  const submitTimesheet = useAppStore((s) => s.submitTimesheet);
  const reopenApprovedTimesheet = useAppStore((s) => s.reopenApprovedTimesheet);

  const isAdmin = state.currentRole === "administrator";
  const isEngineerLike =
    state.currentRole === "engineer" ||
    state.currentRole === "project_manager" ||
    isAdmin;

  const selectableEmployees = state.employees.filter((e) => {
    if (isAdmin) return e.role === "engineer" || e.role === "project_manager";
    if (
      state.currentRole === "engineer" ||
      state.currentRole === "project_manager"
    ) {
      return e.id === state.currentEmployeeId;
    }
    return false;
  });

  const [employeeId, setEmployeeId] = useState(
    selectableEmployees[0]?.id ?? state.currentEmployeeId
  );
  const [weekStart, setWeekStart] = useState(() => {
    const existing = state.timesheets.find(
      (t) =>
        t.employeeId ===
          (selectableEmployees[0]?.id ?? state.currentEmployeeId) &&
        t.status === "draft"
    );
    return (
      existing?.weekStart ??
      format(
        startOfWeek(new Date("2026-03-09"), { weekStartsOn: 1 }),
        "yyyy-MM-dd"
      )
    );
  });

  const timesheet = state.timesheets.find(
    (t) => t.employeeId === employeeId && t.weekStart === weekStart
  );

  const accessibleProjects = getAccessibleProjectIds(
    state.currentRole === "administrator"
      ? "administrator"
      : state.currentRole,
    employeeId,
    state
  );

  const projectIds =
    state.currentRole === "administrator"
      ? state.assignments
          .filter((a) => a.employeeId === employeeId && a.active)
          .map((a) => a.projectId)
      : accessibleProjects.filter((pid) =>
          state.assignments.some(
            (a) =>
              a.employeeId === employeeId && a.projectId === pid && a.active
          )
        );

  const projects = state.projects.filter((p) => projectIds.includes(p.id));
  const days = weekDates(weekStart);

  const seedEntries = useMemo(() => {
    if (!timesheet) return [];
    return state.timeEntries.filter((e) => e.timesheetId === timesheet.id);
  }, [timesheet, state.timeEntries]);

  const editorKey = `${employeeId}|${weekStart}|${timesheet?.id ?? "new"}|${seedEntries
    .map((e) => `${e.id}:${e.hours}`)
    .join(",")}`;

  const editable =
    isEngineerLike &&
    canEditTimesheet(
      state.currentRole,
      state.currentEmployeeId,
      employeeId,
      timesheet?.status ?? "draft"
    );

  const allSheets = state.timesheets
    .filter((t) => {
      if (state.currentRole === "engineer")
        return t.employeeId === state.currentEmployeeId;
      return true;
    })
    .slice()
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  if (!isEngineerLike && state.currentRole === "accounting") {
    return (
      <div>
        <PageHeader
          title="Timesheets"
          description="Accounting can view approved records for billing eligibility. Editing requires Engineer/PM/Admin simulation."
        />
        <TimesheetList state={state} sheets={allSheets} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Weekly Timesheet"
        description="Enter project hours, save draft, and submit for PM approval. Approved entries cannot be edited — reopen creates an audited correction path."
      />

      <Card className="mb-4">
        <CardContent className="grid gap-4 p-4 md:grid-cols-3">
          <div>
            <Label htmlFor="employee">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger id="employee" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="week">Week starting (Mon)</Label>
            <Input
              id="week"
              type="date"
              className="mt-1"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            {timesheet ? (
              <StatusBadge status={timesheet.status} />
            ) : (
              <StatusBadge status="draft" />
            )}
            {timesheet?.rejectionReason ? (
              <span className="text-xs text-red-600">
                {timesheet.rejectionReason}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <TimesheetEditor
        key={editorKey}
        initialLines={entriesToLines(seedEntries)}
        editable={editable}
        projects={projects}
        workOrders={state.workOrders}
        tasks={state.tasks}
        days={days}
        timesheetId={timesheet?.id}
        timesheetStatus={timesheet?.status}
        employeeId={employeeId}
        weekStart={weekStart}
        currentRole={state.currentRole}
        currentEmployeeId={state.currentEmployeeId}
        saveTimesheetDraft={saveTimesheetDraft}
        submitTimesheet={submitTimesheet}
        reopenApprovedTimesheet={reopenApprovedTimesheet}
      />

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">
          All timesheets
        </h2>
        <TimesheetList state={state} sheets={allSheets} />
      </div>
    </div>
  );
}

function TimesheetEditor({
  initialLines,
  editable,
  projects,
  workOrders,
  tasks,
  days,
  timesheetId,
  timesheetStatus,
  employeeId,
  weekStart,
  currentRole,
  currentEmployeeId,
  saveTimesheetDraft,
  submitTimesheet,
  reopenApprovedTimesheet,
}: {
  initialLines: DraftLine[];
  editable: boolean;
  projects: Project[];
  workOrders: WorkOrder[];
  tasks: Task[];
  days: string[];
  timesheetId?: string;
  timesheetStatus?: string;
  employeeId: string;
  weekStart: string;
  currentRole: AppState["currentRole"];
  currentEmployeeId: string;
  saveTimesheetDraft: ReturnType<typeof useAppStore.getState>["saveTimesheetDraft"];
  submitTimesheet: ReturnType<typeof useAppStore.getState>["submitTimesheet"];
  reopenApprovedTimesheet: ReturnType<
    typeof useAppStore.getState
  >["reopenApprovedTimesheet"];
}) {
  const [lines, setLines] = useState<DraftLine[]>(initialLines);

  const addLine = () => {
    const projectId = projects[0]?.id ?? "";
    const wos = workOrders.filter((w) => w.projectId === projectId);
    const taskList = tasks.filter((t) => t.workOrderId === wos[0]?.id);
    setLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        projectId,
        workOrderId: wos[0]?.id ?? "",
        taskId: taskList[0]?.id ?? "",
        date: days[0],
        hours: "8",
        billable: taskList[0]?.billableDefault ?? true,
        notes: "",
      },
    ]);
  };

  const toEntries = () =>
    lines.map((l) => ({
      projectId: l.projectId,
      workOrderId: l.workOrderId,
      taskId: l.taskId,
      date: l.date,
      hours: Number(l.hours),
      billable: l.billable,
      notes: l.notes,
    }));

  const save = () => {
    const result = saveTimesheetDraft({
      timesheetId,
      employeeId,
      weekStart,
      entries: toEntries(),
    });
    if (result.ok) toast.success("Timesheet draft saved");
    else toast.error(result.error);
  };

  const submit = () => {
    const saved = saveTimesheetDraft({
      timesheetId,
      employeeId,
      weekStart,
      entries: toEntries(),
    });
    if (!saved.ok) {
      toast.error(saved.error);
      return;
    }
    const r = submitTimesheet(saved.timesheetId);
    if (r.ok) toast.success("Timesheet submitted for approval");
    else toast.error(r.error);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Time lines</CardTitle>
        {editable ? (
          <Button size="sm" variant="outline" onClick={addLine}>
            Add line
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">
            No lines yet. Add a line for the Solar + BESS project to begin the
            guided demo.
          </p>
        ) : null}
        {lines.map((line, idx) => {
          const wos = workOrders.filter((w) => w.projectId === line.projectId);
          const taskList = tasks.filter((t) => t.workOrderId === line.workOrderId);
          return (
            <div
              key={line.key}
              className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-6"
            >
              <div className="md:col-span-2">
                <Label>Project</Label>
                <Select
                  disabled={!editable}
                  value={line.projectId}
                  onValueChange={(v) => {
                    const wos2 = workOrders.filter((w) => w.projectId === v);
                    const tasks2 = tasks.filter(
                      (t) => t.workOrderId === wos2[0]?.id
                    );
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx
                          ? {
                              ...l,
                              projectId: v,
                              workOrderId: wos2[0]?.id ?? "",
                              taskId: tasks2[0]?.id ?? "",
                              billable: tasks2[0]?.billableDefault ?? true,
                            }
                          : l
                      )
                    );
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Work order</Label>
                <Select
                  disabled={!editable}
                  value={line.workOrderId}
                  onValueChange={(v) => {
                    const tasks2 = tasks.filter((t) => t.workOrderId === v);
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx
                          ? {
                              ...l,
                              workOrderId: v,
                              taskId: tasks2[0]?.id ?? "",
                              billable: tasks2[0]?.billableDefault ?? true,
                            }
                          : l
                      )
                    );
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {wos.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Task</Label>
                <Select
                  disabled={!editable}
                  value={line.taskId}
                  onValueChange={(v) => {
                    const task = tasks.find((t) => t.id === v);
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx
                          ? {
                              ...l,
                              taskId: v,
                              billable: task?.billableDefault ?? l.billable,
                            }
                          : l
                      )
                    );
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskList.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Select
                  disabled={!editable}
                  value={line.date}
                  onValueChange={(v) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, date: v } : l))
                    )
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {days.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hours</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  disabled={!editable}
                  value={line.hours}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, hours: e.target.value } : l
                      )
                    )
                  }
                />
              </div>
              <div className="md:col-span-3">
                <Label>Notes</Label>
                <Textarea
                  className="mt-1"
                  disabled={!editable}
                  value={line.notes}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, notes: e.target.value } : l
                      )
                    )
                  }
                />
              </div>
              <div className="flex items-end gap-3 md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={line.billable}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, billable: e.target.checked } : l
                        )
                      )
                    }
                  />
                  Billable
                </label>
                {editable ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {editable ? (
            <>
              <Button onClick={save}>Save draft</Button>
              {canSubmitTimesheet(
                currentRole,
                currentEmployeeId,
                employeeId
              ) ? (
                <Button variant="success" onClick={submit}>
                  Submit for approval
                </Button>
              ) : null}
            </>
          ) : null}
          {timesheetStatus === "approved" &&
          (currentRole === "administrator" ||
            currentRole === "project_manager") &&
          timesheetId ? (
            <Button
              variant="outline"
              onClick={() => {
                const reason = window.prompt(
                  "Reopen reason (required; audited):"
                );
                if (!reason) return;
                const r = reopenApprovedTimesheet(timesheetId, reason);
                if (r.ok) toast.success("Timesheet reopened");
                else toast.error(r.error);
              }}
            >
              Controlled reopen
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TimesheetList({
  state,
  sheets,
}: {
  state: AppState;
  sheets: AppState["timesheets"];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Week</th>
            <th className="px-4 py-3">Hours</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {sheets.map((t) => {
            const emp = state.employees.find((e) => e.id === t.employeeId);
            const hours = state.timeEntries
              .filter((e) => e.timesheetId === t.id)
              .reduce((s, e) => s + e.hours, 0);
            return (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-2.5">{emp?.name}</td>
                <td className="px-4 py-2.5">{t.weekStart}</td>
                <td className="px-4 py-2.5">{formatHours(hours)}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={t.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
