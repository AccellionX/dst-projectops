import { AppShell } from "@/components/layout/app-shell";

/**
 * Client-state demo shell (Zustand + role simulation) is allowed to block
 * instant-navigation validation. Pages still stream/render normally.
 */
export const instant = false;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
