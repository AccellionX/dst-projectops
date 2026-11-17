"use client";

import { useMemo, useState } from "react";
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
import {
  buildAccountingHandoff,
  buildInvoiceCsv,
  type AllocationRequest,
} from "@/lib/billing/invoice";
import {
  getEligibleBillingItems,
  type EligibleBillingItem,
} from "@/lib/billing/eligibility";
import { formatUsd, titleCase } from "@/lib/format";
import { canCreateInvoice, canExportInvoice } from "@/lib/permissions";
import { useAppStore } from "@/store/use-app-store";
import { createId } from "@/lib/domain/ids";

function selectionFromItem(
  item: EligibleBillingItem,
  partialAmount?: number,
  partialQty?: number
): AllocationRequest {
  if (item.sourceType === "time_entry") {
    const qty = partialQty ?? item.hoursRemaining;
    return {
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      quantity: qty,
      amountCents: Math.round(qty * item.billRateCents),
      description: item.description,
      unitAmountCents: item.billRateCents,
    };
  }
  if (item.sourceType === "accepted_unit") {
    const qty = partialQty ?? item.quantityRemaining;
    return {
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      quantity: qty,
      amountCents: Math.round(qty * item.unitPriceCents),
      description: item.description,
      unitAmountCents: item.unitPriceCents,
    };
  }
  const amount =
    partialAmount ??
    ("amountRemainingCents" in item ? item.amountRemainingCents : 0);
  return {
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    quantity: 1,
    amountCents: amount,
    description: item.description,
    unitAmountCents: amount,
  };
}

export function BillingPage() {
  const state = useAppStore();
  const createInvoice = useAppStore((s) => s.createInvoice);
  const voidInvoice = useAppStore((s) => s.voidInvoice);
  const exportInvoiceDraft = useAppStore((s) => s.exportInvoiceDraft);

  const [projectId, setProjectId] = useState("proj-bess");
  const project = state.projects.find((p) => p.id === projectId);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [handoff, setHandoff] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const eligible = useMemo(
    () => getEligibleBillingItems(state, projectId),
    [state, projectId]
  );

  const canBill = canCreateInvoice(state.currentRole);

  const createDraft = () => {
    if (!project || !canBill) return;
    const key = createId("idem");
    setBusyKey(key);
    const selections = eligible
      .filter((i) => selected[`${i.sourceType}:${i.sourceId}`])
      .map((i) => selectionFromItem(i));

    const result = createInvoice({
      clientId: project.clientId,
      projectId,
      issueDate: "2026-03-15",
      notes,
      selections,
      idempotencyKey: key,
    });
    setBusyKey(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.reused
        ? "Idempotent reuse — same draft returned"
        : `Draft ${result.invoiceId} created with reservations`
    );
    setSelected({});
  };

  const attemptDuplicate = () => {
    // Explicit demo: try to bill te-r1-wed which is already reserved on inv-004
    if (!canBill) {
      toast.error("Switch to Accounting or Admin");
      return;
    }
    const result = createInvoice({
      clientId: "cli-prairie",
      projectId: "proj-bess",
      issueDate: "2026-03-15",
      notes: "Duplicate billing attempt (guided demo)",
      selections: [
        {
          sourceType: "time_entry",
          sourceId: "te-r1-wed",
          quantity: 8,
          amountCents: 140_000,
          description: "Duplicate attempt on reserved hours",
          unitAmountCents: 17500,
        },
      ],
      idempotencyKey: createId("dup-attempt"),
    });
    if (!result.ok) {
      toast.error(`Duplicate billing prevented: ${result.error}`);
    } else {
      toast.success("Unexpected success — check allocation ledger");
    }
  };

  const downloadCsv = (invoiceId: string) => {
    const csv = buildInvoiceCsv(state, invoiceId);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoiceId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showHandoff = (invoiceId: string) => {
    const payload = buildAccountingHandoff(state, invoiceId);
    setHandoff(JSON.stringify(payload, null, 2));
  };

  const doExport = (invoiceId: string) => {
    if (!canExportInvoice(state.currentRole)) {
      toast.error("Export requires Accounting or Admin");
      return;
    }
    const key = `export-${invoiceId}`;
    const result = exportInvoiceDraft(invoiceId, key);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(
        result.reused ? "Already exported (idempotent)" : "Exported & finalized"
      );
      showHandoff(invoiceId);
      downloadCsv(invoiceId);
    }
  };

  const printPdf = (invoiceId: string) => {
    const inv = state.invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const client = state.clients.find((c) => c.id === inv.clientId);
    const proj = state.projects.find((p) => p.id === inv.projectId);
    const lines = state.invoiceLines.filter((l) => l.invoiceId === invoiceId);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${inv.number}</title>
      <style>
        body{font-family:Georgia,serif;padding:40px;color:#0f172a}
        h1{font-size:22px;margin:0}
        .muted{color:#64748b;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:24px}
        th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left;font-size:13px}
        .right{text-align:right}
        .banner{background:#eff6ff;border:1px solid #bfdbfe;padding:8px;margin-bottom:16px;font-size:12px}
      </style></head><body>
      <div class="banner">Concept Demo • Synthetic Data — not a live accounting document</div>
      <h1>${inv.number}</h1>
      <p class="muted">${client?.name ?? ""} · ${proj?.code ?? ""} · Due ${inv.dueDate}</p>
      <table><thead><tr><th>Description</th><th>Qty</th><th class="right">Amount</th></tr></thead><tbody>
      ${lines
        .map(
          (l) =>
            `<tr><td>${l.description}</td><td>${l.quantity}</td><td class="right">${formatUsd(l.amountCents)}</td></tr>`
        )
        .join("")}
      </tbody></table>
      <p class="right"><strong>Total ${formatUsd(inv.totalCents)}</strong></p>
      <script>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div>
      <PageHeader
        title="Billing & Invoices"
        description="Three billing engines with a deterministic allocation ledger. Drafts reserve; void releases; export finalizes. Duplicate allocation is blocked."
        actions={
          <Button variant="outline" onClick={attemptDuplicate}>
            Demo: duplicate billing attempt
          </Button>
        }
      />

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Sample accounting handoff JSON/CSV is for manual import illustration only
        — no live ERP/GL integration in this concept demo.
      </div>

      {!canBill ? (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Creating invoices requires Accounting or Administrator. You can still
          inspect drafts and eligibility.
        </div>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create invoice draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Project</Label>
              <Select
                value={projectId}
                onValueChange={(v) => {
                  setProjectId(v);
                  setSelected({});
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} · {titleCase(p.billingModel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Input
                className="mt-1"
                disabled
                value={
                  state.clients.find((c) => c.id === project?.clientId)?.name ??
                  ""
                }
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">
              Eligible items ({eligible.length})
            </div>
            {eligible.length === 0 ? (
              <p className="text-sm text-slate-500">
                No eligible unallocated items for this project.
              </p>
            ) : (
              <div className="space-y-2">
                {eligible.map((item) => {
                  const key = `${item.sourceType}:${item.sourceId}`;
                  const amount =
                    "amountRemainingCents" in item
                      ? item.amountRemainingCents
                      : 0;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!!selected[key]}
                        disabled={!canBill}
                        onChange={(e) =>
                          setSelected((s) => ({
                            ...s,
                            [key]: e.target.checked,
                          }))
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {item.description}
                        </div>
                        <div className="text-xs text-slate-500">
                          {titleCase(item.sourceType)} · remaining{" "}
                          {formatUsd(amount)}
                          {item.sourceType === "time_entry"
                            ? ` · ${item.hoursRemaining}h @ ${formatUsd(item.billRateCents)}/h`
                            : null}
                          {item.sourceType === "accepted_unit"
                            ? ` · ${item.quantityRemaining} units`
                            : null}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="inv-notes">Notes</Label>
            <Textarea
              id="inv-notes"
              className="mt-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            disabled={!canBill || !!busyKey}
            onClick={createDraft}
          >
            Save draft & reserve allocations
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2 pr-3">Number</th>
                <th className="pb-2 pr-3">Project</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Total</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.invoices.map((inv) => {
                const proj = state.projects.find((p) => p.id === inv.projectId);
                return (
                  <tr key={inv.id} className="border-t border-slate-100">
                    <td className="py-2.5 pr-3 font-medium">{inv.number}</td>
                    <td className="py-2.5 pr-3">{proj?.code}</td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-2.5 pr-3">{formatUsd(inv.totalCents)}</td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => printPdf(inv.id)}
                        >
                          PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadCsv(inv.id)}
                        >
                          CSV
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => showHandoff(inv.id)}
                        >
                          JSON
                        </Button>
                        {inv.status === "draft" ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => doExport(inv.id)}
                              disabled={!canExportInvoice(state.currentRole)}
                            >
                              Export
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                const r = voidInvoice(inv.id);
                                if (r.ok) toast.success("Draft voided — reservations released");
                                else toast.error(r.error);
                              }}
                              disabled={!canBill}
                            >
                              Void
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Allocation ledger</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2">Source</th>
                <th className="pb-2">Invoice</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.allocations.map((a) => {
                const inv = state.invoices.find((i) => i.id === a.invoiceId);
                return (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="py-2">
                      {a.sourceType}:{a.sourceId}
                    </td>
                    <td className="py-2">{inv?.number}</td>
                    <td className="py-2">{a.quantity}</td>
                    <td className="py-2">{formatUsd(a.amountCents)}</td>
                    <td className="py-2">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {handoff ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Accounting handoff payload (sample)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
              {handoff}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
