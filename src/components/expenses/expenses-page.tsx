"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
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
import { formatDate, formatUsd, titleCase } from "@/lib/format";
import { getAccessibleProjectIds } from "@/lib/permissions";
import { useAppStore } from "@/store/use-app-store";
import { Receipt } from "lucide-react";
import type { ExpenseCategory } from "@/types";

const CATEGORIES: ExpenseCategory[] = [
  "travel",
  "lodging",
  "meals",
  "equipment",
  "software",
  "subcontractor",
  "other",
];

export function ExpensesPage() {
  const state = useAppStore();
  const saveExpense = useAppStore((s) => s.saveExpense);
  const submitExpense = useAppStore((s) => s.submitExpense);

  const canCreate =
    state.currentRole === "engineer" ||
    state.currentRole === "project_manager" ||
    state.currentRole === "administrator";

  const projectIds = getAccessibleProjectIds(
    state.currentRole,
    state.currentEmployeeId,
    state
  );
  const projects = state.projects.filter((p) =>
    state.currentRole === "administrator"
      ? state.assignments.some(
          (a) =>
            a.employeeId === state.currentEmployeeId && a.projectId === p.id
        ) || true
      : projectIds.includes(p.id)
  );

  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const workOrders = state.workOrders.filter((w) => w.projectId === projectId);
  const [workOrderId, setWorkOrderId] = useState(workOrders[0]?.id ?? "");
  const [date, setDate] = useState("2026-03-10");
  const [category, setCategory] = useState<ExpenseCategory>("travel");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [billable, setBillable] = useState(true);
  const [receipt, setReceipt] = useState<{
    fileName: string;
    mimeType: string;
    dataUrl: string;
    sizeBytes: number;
  } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const expenses = state.expenses.filter((e) => {
    if (state.currentRole === "engineer") {
      return e.employeeId === state.currentEmployeeId;
    }
    return true;
  });

  const onFile = async (file: File | null) => {
    if (!file) {
      setReceipt(null);
      return;
    }
    if (file.size > 1_500_000) {
      toast.error("Demo receipt limit is 1.5MB (browser-local storage).");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setReceipt({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      dataUrl,
      sizeBytes: file.size,
    });
  };

  const save = (andSubmit: boolean) => {
    const dollars = Number(amount);
    if (!description.trim()) {
      toast.error("Description is required.");
      return;
    }
    const result = saveExpense({
      employeeId: state.currentEmployeeId,
      projectId,
      workOrderId,
      date,
      category,
      description: description.trim(),
      amountCents: Math.round(dollars * 100),
      billable,
      reimbursable: true,
      receipt,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (andSubmit) {
      const sub = submitExpense(result.expenseId);
      if (!sub.ok) {
        toast.error(sub.error);
        return;
      }
      toast.success("Expense submitted for approval");
    } else {
      toast.success("Expense draft saved");
    }
    setDescription("");
    setAmount("");
    setReceipt(null);
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Mobile-friendly capture with receipt preview. Rejected and unapproved expenses cannot be invoiced. Receipts persist in browser storage only."
      />

      {canCreate ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>New expense</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Project</Label>
              <Select
                value={projectId}
                onValueChange={(v) => {
                  setProjectId(v);
                  const wo = state.workOrders.find((w) => w.projectId === v);
                  setWorkOrderId(wo?.id ?? "");
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
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
              <Select value={workOrderId} onValueChange={setWorkOrderId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workOrders.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="exp-date">Date</Label>
              <Input
                id="exp-date"
                type="date"
                className="mt-1"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ExpenseCategory)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {titleCase(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="exp-amt">Amount (USD)</Label>
              <Input
                id="exp-amt"
                type="number"
                min={0}
                step={0.01}
                className="mt-1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={billable}
                  onChange={(e) => setBillable(e.target.checked)}
                />
                Billable to client
              </label>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="exp-desc">Description</Label>
              <Textarea
                id="exp-desc"
                className="mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="exp-receipt">Receipt (image or PDF)</Label>
              <Input
                id="exp-receipt"
                type="file"
                accept="image/*,application/pdf"
                className="mt-1"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Stored as a data URL in localStorage for this demo. Large files
                may be truncated by browser quota.
              </p>
              {receipt ? (
                <div className="mt-2 rounded-lg border border-slate-200 p-2 text-xs">
                  {receipt.fileName} ({Math.round(receipt.sizeBytes / 1024)} KB)
                  {receipt.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={receipt.dataUrl}
                      alt="Receipt preview"
                      className="mt-2 max-h-40 rounded"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button variant="outline" onClick={() => save(false)}>
                Save draft
              </Button>
              <Button onClick={() => save(true)}>Submit</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses"
          description="Create an expense to demonstrate approval and billing eligibility rules."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Billable</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const emp = state.employees.find((x) => x.id === e.employeeId);
                const proj = state.projects.find((p) => p.id === e.projectId);
                const rcpt = state.receipts.find((r) => r.id === e.receiptId);
                return (
                  <tr key={e.id} className="border-t">
                    <td className="px-4 py-2.5">{formatDate(e.date)}</td>
                    <td className="px-4 py-2.5">{emp?.name}</td>
                    <td className="px-4 py-2.5">{proj?.code}</td>
                    <td className="px-4 py-2.5">{titleCase(e.category)}</td>
                    <td className="px-4 py-2.5">{formatUsd(e.amountCents)}</td>
                    <td className="px-4 py-2.5">{e.billable ? "Yes" : "No"}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={e.status} />
                      {e.rejectionReason ? (
                        <div className="mt-1 text-xs text-red-600">
                          {e.rejectionReason}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      {rcpt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setPreviewId(previewId === rcpt.id ? null : rcpt.id)
                          }
                        >
                          Preview
                        </Button>
                      ) : (
                        "—"
                      )}
                      {previewId === rcpt?.id && rcpt ? (
                        <div className="mt-2">
                          {rcpt.mimeType.startsWith("image/") ||
                          rcpt.dataUrl.startsWith("data:image") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={rcpt.dataUrl}
                              alt={rcpt.fileName}
                              className="max-h-32 rounded border"
                            />
                          ) : (
                            <a
                              className="text-xs text-navy-700 underline"
                              href={rcpt.dataUrl}
                              download={rcpt.fileName}
                            >
                              Download {rcpt.fileName}
                            </a>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
