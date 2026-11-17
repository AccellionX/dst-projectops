"use client";

import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAppStore } from "@/store/use-app-store";
import { Toaster } from "sonner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const setHydrated = useAppStore((s) => s.setHydrated);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    void useAppStore.persist.rehydrate().then(() => setHydrated(true));
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [setHydrated]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Suspense
        fallback={
          <aside className="hidden w-60 shrink-0 border-r border-navy-900 bg-navy-900 md:block" />
        }
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <Toaster richColors position="top-right" closeButton />
    </div>
  );
}
