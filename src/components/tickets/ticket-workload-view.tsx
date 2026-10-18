"use client";

import { useState } from "react";
import { TicketTable } from "@/components/tickets/ticket-table";
import type { Ticket } from "@/lib/types";
import { isTicketOverdue } from "@/lib/utils";

type WorkloadFilter = "all" | "assigned" | "approval" | "overdue";

const filters: Array<{ value: WorkloadFilter; label: string }> = [
  { value: "all", label: "All tickets" },
  { value: "assigned", label: "Assigned to me" },
  { value: "approval", label: "Waiting for approval" },
  { value: "overdue", label: "Overdue" }
];

export function TicketWorkloadView({ tickets, currentUserId }: { tickets: Ticket[]; currentUserId?: string }) {
  const [filter, setFilter] = useState<WorkloadFilter>("all");
  const visibleTickets = tickets.filter((ticket) => {
    if (filter === "assigned") {
      return ticket.assigned_to === currentUserId && !["resolved", "closed", "rejected"].includes(ticket.status);
    }
    if (filter === "approval") return ticket.approval_status === "pending";
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
              {item.value === "all" ? tickets.length : tickets.filter((ticket) => {
                if (item.value === "assigned") return ticket.assigned_to === currentUserId && !["resolved", "closed", "rejected"].includes(ticket.status);
                if (item.value === "approval") return ticket.approval_status === "pending";
                return isTicketOverdue(ticket);
              }).length}
            </span>
          </button>
        ))}
      </div>
      <TicketTable tickets={visibleTickets} />
    </section>
  );
}
