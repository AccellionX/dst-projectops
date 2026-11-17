import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";

const map: Record<string, "default" | "secondary" | "success" | "warning" | "danger" | "info" | "outline"> = {
  draft: "secondary",
  submitted: "info",
  approved: "success",
  rejected: "danger",
  returned: "warning",
  active: "success",
  planning: "info",
  on_hold: "warning",
  completed: "default",
  closed: "outline",
  open: "info",
  in_progress: "info",
  cancelled: "outline",
  exported: "success",
  void: "danger",
  reserved: "warning",
  finalized: "success",
  released: "outline",
  pending: "secondary",
  ready_to_bill: "info",
  partially_billed: "warning",
  fully_billed: "success",
  accepted: "success",
  billed: "default",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={map[status] ?? "secondary"}>{titleCase(status)}</Badge>;
}
