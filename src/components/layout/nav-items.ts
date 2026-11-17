import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Clock,
  Receipt,
  CheckSquare,
  Calculator,
  FileText,
  Building2,
  ScrollText,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects & Jobs", icon: FolderKanban },
  { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/timesheets", label: "Timesheets", icon: Clock },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  {
    href: "/approvals",
    label: "Approvals",
    icon: CheckSquare,
    roles: ["administrator", "project_manager"],
  },
  {
    href: "/job-costing",
    label: "Job Costing",
    icon: Calculator,
    roles: ["administrator", "project_manager", "accounting"],
  },
  {
    href: "/billing",
    label: "Billing & Invoices",
    icon: FileText,
    roles: ["administrator", "accounting", "project_manager"],
  },
  { href: "/clients", label: "Clients", icon: Building2 },
  {
    href: "/audit",
    label: "Audit Trail",
    icon: ScrollText,
    roles: ["administrator", "accounting"],
  },
  { href: "/settings", label: "Guided Demo", icon: BookOpen },
];

export function visibleNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  );
}
