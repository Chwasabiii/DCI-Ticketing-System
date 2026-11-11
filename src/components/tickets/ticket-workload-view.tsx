"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { TicketTable } from "@/components/tickets/ticket-table";
import type { Ticket, TicketSlaPolicy } from "@/lib/types";
import { cn, isTicketResolutionOverdue } from "@/lib/utils";

type WorkloadFilter = "all" | "assigned" | "overdue";

const filters: Array<{ value: WorkloadFilter; label: string }> = [
  { value: "all", label: "All tickets" },
  { value: "assigned", label: "Assigned to me" },
  { value: "overdue", label: "Overdue" }
];

export function TicketWorkloadView({ tickets, currentUserId, slaPolicies = [], canCreateTickets = false }: { tickets: Ticket[]; currentUserId?: string; slaPolicies?: TicketSlaPolicy[]; canCreateTickets?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [refreshing, startRefresh] = useTransition();
  const requestedFilter = searchParams.get("view");
  const filter: WorkloadFilter = filters.some((item) => item.value === requestedFilter)
    ? requestedFilter as WorkloadFilter
    : "all";

  function setFilter(nextFilter: WorkloadFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter === "all") params.delete("view");
    else params.set("view", nextFilter);
    params.delete("page");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  const visibleTickets = tickets.filter((ticket) => {
    if (filter === "assigned") {
      return ticket.assigned_to === currentUserId && !["resolved", "closed", "rejected"].includes(ticket.status);
    }
    if (filter === "overdue") return isTicketResolutionOverdue(ticket, slaPolicies);
    return true;
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-1.5" aria-label="Filter tickets">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={cn(
              "focus-ring min-h-9 rounded-control border px-3 text-sm font-medium transition-colors duration-150",
              filter === item.value
                ? "border-accent-strong bg-white text-accent-strong"
                : "border-border bg-transparent text-muted hover:bg-white"
            )}
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted" aria-live="polite">
        <span>{refreshing ? "Updating tickets…" : tickets.length ? "Tickets up to date" : "No tickets to show"}</span>
        <button type="button" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing} className="inline-flex min-h-8 items-center gap-1.5 rounded-control px-2 font-medium text-accent transition-colors duration-150 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
      </div>
      <TicketTable tickets={visibleTickets} slaPolicies={slaPolicies} createTicketHref={canCreateTickets ? "/tickets/new" : undefined} />
    </section>
  );
}
