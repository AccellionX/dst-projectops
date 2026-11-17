"use client";

import { Menu, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getRoleLabel, useAppStore } from "@/store/use-app-store";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const employees = useAppStore((s) => s.employees);
  const currentEmployeeId = useAppStore((s) => s.currentEmployeeId);
  const currentRole = useAppStore((s) => s.currentRole);
  const switchRole = useAppStore((s) => s.switchRole);
  const meta = useAppStore((s) => s.meta);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-slate-500">
          {meta.label}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 sm:flex">
          <Shield className="h-3.5 w-3.5" />
          Role simulation
        </div>
        <div className="w-[200px] sm:w-[260px]">
          <Select value={currentEmployeeId} onValueChange={switchRole}>
            <SelectTrigger aria-label="Switch simulated role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {employees
                .filter((e) => e.active)
                .map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {getRoleLabel(e.role)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="hidden text-xs text-slate-500 lg:block">
          {getRoleLabel(currentRole)}
        </div>
      </div>
    </header>
  );
}
