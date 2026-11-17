"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
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
import { canResetDemo } from "@/lib/permissions";
import { useAppStore } from "@/store/use-app-store";
import { CheckCircle2 } from "lucide-react";

const STEPS = [
  {
    n: 1,
    title: "Switch to Engineer",
    detail: "Use the top-bar role switcher → Riley Santos (Engineer).",
    href: "/settings",
  },
  {
    n: 2,
    title: "Open weekly timesheet",
    detail: "Go to Timesheets. Select week starting 2026-03-09 (draft exists).",
    href: "/timesheets",
  },
  {
    n: 3,
    title: "Enter hours on Solar + BESS",
    detail:
      "Add/edit lines on BESS-2026-017 (PSS/E or PSCAD). Save draft.",
    href: "/timesheets",
  },
  {
    n: 4,
    title: "Submit for approval",
    detail: "Click Submit for approval. Status becomes Submitted.",
    href: "/timesheets",
  },
  {
    n: 5,
    title: "Switch to PM",
    detail: "Role switcher → Jordan Hale (Project Manager).",
    href: "/approvals",
  },
  {
    n: 6,
    title: "Approve",
    detail: "Open Approvals, approve the submitted timesheet. Confirm dialog.",
    href: "/approvals",
  },
  {
    n: 7,
    title: "Review updated project cost",
    detail:
      "Open Job Costing for BESS-2026-017. Approved labor cost increases.",
    href: "/job-costing",
  },
  {
    n: 8,
    title: "Switch to Accounting",
    detail: "Role switcher → Casey Nguyen (Accounting).",
    href: "/billing",
  },
  {
    n: 9,
    title: "Create invoice draft",
    detail:
      "Billing → select BESS project → choose newly eligible approved hours → Save draft.",
    href: "/billing",
  },
  {
    n: 10,
    title: "Attempt second allocation",
    detail:
      "Click “Demo: duplicate billing attempt” (targets hours already reserved on INV-DEMO-0004 / te-r1-wed).",
    href: "/billing",
  },
  {
    n: 11,
    title: "Show prevention of duplication",
    detail:
      "Expect toast: Duplicate billing prevented. Allocation ledger shows reserved/finalized rows.",
    href: "/billing",
  },
  {
    n: 12,
    title: "Export accounting package",
    detail:
      "Export a draft invoice → CSV download + JSON handoff preview. Not a live integration.",
    href: "/billing",
  },
];

export function GuidedDemoPage() {
  const state = useAppStore();
  const resetDemo = useAppStore((s) => s.resetDemo);
  const switchRole = useAppStore((s) => s.switchRole);
  const [confirmReset, setConfirmReset] = useState(false);
  const [done, setDone] = useState<Record<number, boolean>>({});

  return (
    <div>
      <PageHeader
        title="Guided Demo"
        description="Step-by-step script for the engineer → PM → costing → billing journey. Reset restores deterministic seed data."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => switchRole("emp-eng-riley")}
            >
              Jump to Engineer
            </Button>
            {canResetDemo(state.currentRole) ? (
              <Button variant="destructive" onClick={() => setConfirmReset(true)}>
                Reset Demo Data
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  switchRole("emp-admin");
                  toast.message("Switched to Admin so you can reset");
                }}
              >
                Switch to Admin to reset
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-6 border-sky-200 bg-sky-50/60">
        <CardContent className="space-y-2 p-5 text-sm text-sky-950">
          <p>
            <strong>Concept Demo • Synthetic Data.</strong> Independent
            speculative prototype — not an authorized DST Engineers product.
          </p>
          <p>
            Role switching is a simulation for pre-sales storytelling, not
            production authentication. All figures use fictional clients, rates,
            and budgets.
          </p>
          <p className="text-xs">
            Seed version {state.meta.seedVersion}. Current actor:{" "}
            {state.employees.find((e) => e.id === state.currentEmployeeId)?.name}{" "}
            ({state.currentRole}).
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {STEPS.map((step) => (
          <Card key={step.n}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <button
                  type="button"
                  className="mt-0.5"
                  aria-label={`Mark step ${step.n} done`}
                  onClick={() =>
                    setDone((d) => ({ ...d, [step.n]: !d[step.n] }))
                  }
                >
                  <CheckCircle2
                    className={`h-5 w-5 ${
                      done[step.n] ? "text-emerald-600" : "text-slate-300"
                    }`}
                  />
                </button>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {step.n}. {step.title}
                  </div>
                  <p className="text-sm text-slate-600">{step.detail}</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={step.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Expected outputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>
            After step 6, Job Costing approved labor for BESS increases by the
            approved hours × Riley’s internal cost rate ($85/h).
          </p>
          <p>
            After step 9, a new draft invoice appears with <em>reserved</em>{" "}
            allocation rows; those hours disappear from eligible items.
          </p>
          <p>
            Step 10–11 demonstrates that <code>te-r1-wed</code> (already reserved
            on INV-DEMO-0004) cannot be billed again.
          </p>
          <p>
            Step 12 finalizes allocations (status → finalized) and downloads a
            CSV plus sample JSON handoff — for manual accounting import mapping
            only.
          </p>
        </CardContent>
      </Card>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset demo data?</DialogTitle>
            <DialogDescription>
              This restores the deterministic seed (version {state.meta.seedVersion})
              and clears local changes. Guided walkthrough will work consistently
              again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetDemo();
                setDone({});
                setConfirmReset(false);
                toast.success("Demo data reset");
              }}
            >
              Reset now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
