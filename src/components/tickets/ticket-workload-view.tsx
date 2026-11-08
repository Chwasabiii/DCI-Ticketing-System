"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { TicketTable } from "@/components/tickets/ticket-table";
import type { Ticket, TicketSlaPolicy } from "@/lib/types";
import { isTicketResolutionOverdue } from "@/lib/utils";

type WorkloadFilter = "all" | "assigned" | "overdue";

const filters: Array<{ value: WorkloadFilter; label: string }> = [
  { value: "all", label: "All tickets" },
  { value: "assigned", label: "Assigned to me" },
  { value: "overdue", label: "Overdue" }
];

export function TicketWorkloadView({ tickets, currentUserId, slaPolicies = [] }: { tickets: Ticket[]; currentUserId?: string; slaPolicies?: TicketSlaPolicy[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [filter, setFilter] = useState<WorkloadFilter>("all");

  const visibleTickets = tickets.filter((ticket) => {
    if (filter === "assigned") {
      return ticket.assigned_to === currentUserId && !["resolved", "closed", "rejected"].includes(ticket.status);
    }
    if (filter === "overdue") return isTicketResolutionOverdue(ticket, slaPolicies);
    return true;
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Filter tickets">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={`focus-ring min-h-10 rounded-xl border px-4 text-sm font-semibold transition-colors ${
              filter === item.value
                ? "border-accent bg-blue-50 text-accent"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.label}
            <span className="ml-2 text-xs opacity-70">
              {item.value === "all" ? tickets.length : tickets.filter((ticket) => {
                if (item.value === "assigned") return ticket.assigned_to === currentUserId && !["resolved", "closed", "rejected"].includes(ticket.status);
                return isTicketResolutionOverdue(ticket, slaPolicies);
              }).length}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-500" aria-live="polite">
        <span>{refreshing ? "Updating tickets…" : tickets.length ? "Tickets up to date" : "No tickets to show"}</span>
        <button type="button" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 font-semibold text-accent hover:bg-blue-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
      </div>
      <TicketTable tickets={visibleTickets} slaPolicies={slaPolicies} />
    </section>
  );
}
