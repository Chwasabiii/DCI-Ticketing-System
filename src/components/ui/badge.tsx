import { cn, titleCase } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  open: "bg-blue-50 text-blue-700 ring-blue-200",
  under_review: "bg-amber-50 text-amber-700 ring-amber-200",
  assigned: "bg-sky-50 text-sky-700 ring-sky-200",
  in_progress: "bg-orange-50 text-orange-700 ring-orange-200",
  waiting_for_info: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  resolved: "bg-green-50 text-green-700 ring-green-200",
  closed: "bg-slate-100 text-slate-700 ring-slate-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  urgent: "bg-red-50 text-red-700 ring-red-200",
  high: "bg-orange-50 text-orange-700 ring-orange-200",
  medium: "bg-blue-50 text-blue-700 ring-blue-200",
  low: "bg-slate-100 text-slate-700 ring-slate-200",
  planned: "bg-violet-50 text-violet-700 ring-violet-200",
  ongoing: "bg-green-50 text-green-700 ring-green-200",
  completed: "bg-slate-100 text-slate-700 ring-slate-200",
  confidential: "bg-violet-50 text-violet-700 ring-violet-200",
  service_request: "bg-blue-50 text-blue-700 ring-blue-200",
  access_request: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  incident_report: "bg-orange-50 text-orange-700 ring-orange-200"
};

export function Badge({
  value,
  className
}: {
  value?: string | null;
  className?: string;
}) {
  const normalized = value ?? "unset";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        statusStyles[normalized] ?? "bg-slate-100 text-slate-700 ring-slate-200",
        className
      )}
    >
      {titleCase(normalized)}
    </span>
  );
}

const ticketStatusStyles: Record<string, string> = {
  open: "border-status-open/20 bg-status-open-bg text-status-open",
  under_review: "border-status-open/20 bg-status-open-bg text-status-open",
  assigned: "border-status-open/20 bg-status-open-bg text-status-open",
  in_progress: "border-status-open/20 bg-status-open-bg text-status-open",
  waiting_for_info: "border-status-waiting/20 bg-status-waiting-bg text-status-waiting",
  resolved: "border-status-resolved/20 bg-status-resolved-bg text-status-resolved",
  closed: "border-status-closed/20 bg-status-closed-bg text-status-closed",
  rejected: "border-status-rejected/20 bg-status-rejected-bg text-status-rejected"
};

export function StatusBadge({ value }: { value?: string | null }) {
  const normalized = value ?? "unset";

  return (
    <span     className={cn(
      "inline-flex rounded-control border px-1.5 py-0.5 text-xs font-medium leading-4",
      ticketStatusStyles[normalized] ?? "border-border bg-page text-muted"
    )}>
      {titleCase(normalized)}
    </span>
  );
}

export function PriorityBadge({ value }: { value?: string | null }) {
  const normalized = value ?? "unset";
  const isHigh = normalized === "urgent" || normalized === "high";
  const styles = isHigh
    ? "border-priority-high/20 bg-priority-high-bg text-priority-high"
    : "border-priority-medium/20 bg-priority-medium-bg text-priority-medium";

  return (
    <span     className={cn("inline-flex rounded-control border px-1.5 py-0.5 text-xs font-medium leading-4", styles)}>
      {titleCase(normalized)}
    </span>
  );
}
