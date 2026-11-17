"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatUsd } from "@/lib/format";
import { useAppStore } from "@/store/use-app-store";

export function ClientsPage() {
  const state = useAppStore();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const clients = state.clients.filter((c) =>
    `${c.name} ${c.code} ${c.primaryContact}`.toLowerCase().includes(q.toLowerCase())
  );
  const client = state.clients.find((c) => c.id === selected);

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Synthetic client records only — not actual DST customers."
      />

      <Input
        className="mb-4 max-w-md"
        placeholder="Search clients…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search clients"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clients.map((c) => {
          const projects = state.projects.filter((p) => p.clientId === c.id);
          return (
            <Card
              key={c.id}
              className="cursor-pointer transition hover:border-navy-500/40"
              onClick={() => setSelected(c.id)}
            >
              <CardHeader>
                <CardTitle>{c.name}</CardTitle>
                <p className="text-xs text-slate-500">
                  {c.code} · {c.industry}
                </p>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <p>{c.primaryContact}</p>
                <p className="text-xs">{c.email}</p>
                <p className="mt-2 text-xs">
                  {projects.length} active project(s) · Net {c.paymentTermsDays}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{client?.name}</SheetTitle>
          </SheetHeader>
          {client ? (
            <SheetBody className="space-y-4 text-sm">
              <div>
                <div className="text-xs uppercase text-slate-500">Contact</div>
                <p>{client.primaryContact}</p>
                <p>{client.email}</p>
                <p>{client.phone}</p>
                <p className="mt-1 text-slate-600">{client.billingAddress}</p>
              </div>
              <div>
                <div className="mb-2 text-xs uppercase text-slate-500">
                  Projects
                </div>
                {state.projects
                  .filter((p) => p.clientId === client.id)
                  .map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="mb-2 block rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                    >
                      <div className="font-medium text-navy-800">{p.code}</div>
                      <div className="text-xs text-slate-500">{p.name}</div>
                      <div className="mt-1 flex gap-2">
                        <StatusBadge status={p.status} />
                        <span className="text-xs text-slate-500">
                          Contract {formatUsd(p.contractValueCents)}
                        </span>
                      </div>
                    </Link>
                  ))}
              </div>
              <div>
                <div className="mb-2 text-xs uppercase text-slate-500">
                  Invoices
                </div>
                {state.invoices
                  .filter((i) => i.clientId === client.id)
                  .map((i) => (
                    <div
                      key={i.id}
                      className="mb-2 flex items-center justify-between rounded-lg border border-slate-200 p-3"
                    >
                      <div>
                        <div className="font-medium">{i.number}</div>
                        <div className="text-xs text-slate-500">
                          {formatUsd(i.totalCents)}
                        </div>
                      </div>
                      <StatusBadge status={i.status} />
                    </div>
                  ))}
              </div>
            </SheetBody>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
