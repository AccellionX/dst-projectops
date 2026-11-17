"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Hexagon } from "lucide-react";
import { visibleNav } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";
import { Button } from "@/components/ui/button";

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const role = useAppStore((s) => s.currentRole);
  const items = visibleNav(role);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-navy-700/60 px-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
          <Hexagon className="h-4 w-4 text-sky-300" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              DST ProjectOps
            </div>
            <div className="truncate text-[10px] uppercase tracking-wide text-sky-200/80">
              Concept Demo
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white",
                collapsed && "justify-center px-2"
              )}
              title={item.label}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-navy-700/60 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
        {!collapsed && (
          <p className="mt-2 px-2 text-[10px] leading-relaxed text-slate-400">
            Concept Demo • Synthetic Data. Role simulation only — not production authentication.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-navy-900 bg-navy-900 transition-[width] duration-200 md:block",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Close menu"
            onClick={onMobileClose}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-navy-900 shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
