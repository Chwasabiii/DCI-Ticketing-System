"use client";

import { useEffect, useState } from "react";
import { TicketTable } from "@/components/tickets/ticket-table";
import type { Ticket } from "@/lib/types";
import { isTicketOverdue } from "@/lib/utils";
import { cacheTickets, readCachedTickets } from "@/lib/ticket-list-cache";
import { RefreshCw } from "lucide-react";

type WorkloadFilter = "all" | "assigned" | "overdue";

const filters: Array<{ value: WorkloadFilter; label: string }> = [
  { value: "all", label: "All tickets" },
  { value: "assigned", label: "Assigned to me" },
  { value: "overdue", label: "Overdue" }
];

export function TicketWorkloadView({ tickets, currentUserId }: { tickets: Ticket[]; currentUserId?: string }) {
  const [ticketList, setTicketList] = useState(tickets);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [filter, setFilter] = useState<WorkloadFilter>("all");
  useEffect(() => {
    if (!currentUserId) return;
    const cached = readCachedTickets(currentUserId);
    if (cached.length) setTicketList(cached);
    setHasLoaded(true);
    let active = true;
    setRefreshing(true);
    fetch("/api/my-tickets", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Ticket refresh failed");
        return await response.json() as { tickets: Ticket[] };
      })
      .then(({ tickets: freshTickets }) => {
        if (!active) return;
        setTicketList(freshTickets);
        cacheTickets(currentUserId, freshTickets);
        setIsOffline(false);
      })
      .catch(() => { if (active) setIsOffline(true); })
      .finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, [currentUserId, refreshCount]);

  const visibleTickets = ticketList.filter((ticket) => {
    if (filter === "assigned") {
      return ticket.assigned_to === currentUserId && !["resolved", "closed", "rejected"].includes(ticket.status);
    }
    if (filter === "overdue") return isTicketOverdue(ticket);
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
              {item.value === "all" ? ticketList.length : ticketList.filter((ticket) => {
                if (item.value === "assigned") return ticket.assigned_to === currentUserId && !["resolved", "closed", "rejected"].includes(ticket.status);
                return isTicketOverdue(ticket);
              }).length}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-500" aria-live="polite">
        <span>{refreshing ? (ticketList.length ? "Showing saved tickets · updating…" : "Loading your tickets…") : isOffline ? "Showing saved tickets · offline" : ticketList.length ? "Tickets up to date" : "No tickets loaded"}</span>
        <button type="button" onClick={() => setRefreshCount((count) => count + 1)} disabled={refreshing} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 font-semibold text-accent hover:bg-blue-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />Refresh</button>
      </div>
      {hasLoaded ? <TicketTable tickets={visibleTickets} /> : <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading your tickets…</div>}
    </section>
  );
}
