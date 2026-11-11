"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertCircle, ArrowUpRight, ChevronLeft, ChevronRight, LockKeyhole, Ticket as TicketIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TicketListTable } from "@/components/tickets/ticket-list-table";
import type { Ticket } from "@/lib/types";
import { formatDate, getCcgDeadlineIndicators, getTicketResolutionDueLabel, getTicketSlaIndicators, needsTicketPriorityReview } from "@/lib/utils";
import { TicketQueueActions } from "@/components/tickets/ticket-queue-actions";
import type { Profile, TicketSlaPolicy } from "@/lib/types";

function requestTypeLabel(type: Ticket["request_type"]) {
  if (type === "access_request") return "Access request";
  if (type === "incident_report") return "Incident report";
  return "Service request";
}

function serviceCategoryLabel(category: Ticket["service_category"]) {
  return (category ?? "other_services").replaceAll("_", " ");
}

export function TicketTable({
  tickets,
  nextActions = {},
  queueActions,
  selectedIds,
  onToggleSelection,
  selectableIds,
  slaPolicies = [],
  variant = "list",
  createTicketHref
}: {
  tickets: Ticket[];
  nextActions?: Record<string, string>;
  queueActions?: { employees: Profile[]; canAssign: boolean; canChangeStatus: boolean; canClaim: boolean; currentUserId: string };
  selectedIds?: string[];
  onToggleSelection?: (id: string) => void;
  selectableIds?: string[];
  slaPolicies?: TicketSlaPolicy[];
  variant?: "list" | "table";
  createTicketHref?: string;
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredTickets = useMemo(() => {
    const matches = tickets.filter((ticket) => {
      const searchableFields = [
        ticket.ticket_no,
        ticket.title,
        ticket.status,
        ticket.priority,
        ticket.service_category,
        ticket.assignee?.full_name,
        ticket.assignee?.email
      ];
      return !normalizedQuery || searchableFields.some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
    });

    return matches.sort((a, b) => {
      if (sortBy === "priority") {
        const ranks: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (ranks[String(b.priority)] ?? 0) - (ranks[String(a.priority)] ?? 0);
      }
      if (sortBy === "status") return String(a.status).localeCompare(String(b.status));
      if (sortBy === "category") return String(a.service_category).localeCompare(String(b.service_category));
      if (sortBy === "subject") return a.title.localeCompare(b.title);
      if (sortBy === "created") return Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "");
      return Date.parse(b.updated_at ?? b.created_at ?? "") - Date.parse(a.updated_at ?? a.created_at ?? "");
    });
  }, [tickets, normalizedQuery, sortBy]);
  const pageCount = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleTickets = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (variant === "table") {
    return <TicketListTable tickets={tickets} createTicketHref={createTicketHref} />;
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-accent">
          <TicketIcon className="h-5 w-5" />
        </span>
        <h3 className="mt-4 font-bold text-navy">No tickets to show</h3>
        <p className="mt-1 text-sm text-slate-500">
          Tickets you can access will appear here when they’re opened.
        </p>
      </div>
    );
  }


  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
      <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-xs text-slate-500">Showing {filteredTickets.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredTickets.length)} of {filteredTickets.length} tickets</p>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(13rem,1fr)_auto]">
        <label className="w-full">
          <span className="sr-only">Search tickets</span>
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search tickets and status..."
            className="min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus-ring"
          />
        </label>
        <label className="sr-only" htmlFor="ticket-sort">Sort tickets</label>
        <select id="ticket-sort" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-ring"><option value="newest">Newest first</option><option value="priority">Highest priority</option><option value="status">Status</option></select>
        </div>
      </div>
      {visibleTickets.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">No tickets match “{query}”.</p>
      ) : (
      <ul className="divide-y divide-slate-100">
        {visibleTickets.map((ticket) => (
          <li key={ticket.id}>
            <div className="flex items-start gap-3">
            {selectedIds && onToggleSelection && (!selectableIds || selectableIds.includes(String(ticket.id))) && <label className="flex min-h-14 shrink-0 items-center pl-4 sm:pl-5"><input type="checkbox" checked={selectedIds.includes(String(ticket.id))} onChange={() => onToggleSelection(String(ticket.id))} aria-label={`Select ${ticket.ticket_no ?? `ticket ${ticket.id}`}`} className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent" /></label>}
            <div className="min-w-0 flex-1">
            <Link
              href={`/tickets/${ticket.id}`}
              className="group grid gap-3 p-4 transition-colors hover:bg-slate-50/80 focus-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-accent">
                  <TicketIcon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-xs font-bold text-accent">
                      {ticket.ticket_no ?? `Ticket #${ticket.id}`}
                    </span>
                    {ticket.is_confidential && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                        <LockKeyhole className="h-3 w-3" /> Confidential
                      </span>
                    )}
                    {needsTicketPriorityReview(ticket) && (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                        Review {ticket.reported_impact ?? "?"}/{ticket.reported_urgency ?? "?"}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-sm font-bold text-navy group-hover:text-accent">
                    {ticket.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{ticket.ccg_request_type ? (ticket.ccg_request_types?.length ? ticket.ccg_request_types : [ticket.ccg_request_type]).map((type) => ({ unit_rate: "Unit rate", vendor_list: "Vendor list", tor_contracts: "TOR / contracts" }[type] ?? "CCG request")).join(" + ") : requestTypeLabel(ticket.request_type)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{ticket.ccg_request_scope ? ticket.ccg_request_scope.replaceAll("_", " ") : serviceCategoryLabel(ticket.service_category)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Opened {formatDate(ticket.created_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      {getTicketResolutionDueLabel(ticket, slaPolicies).startsWith("Overdue") && <AlertCircle className="h-3 w-3 text-urgent" />}
                      {getTicketResolutionDueLabel(ticket, slaPolicies)}
                    </span>
                  </span>
                  {nextActions[String(ticket.id)] && (
                    <span className="mt-2 inline-flex rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">
                      Next: {nextActions[String(ticket.id)]}
                    </span>
                  )}
                  {(slaPolicies.length > 0 || ticket.ccg_request_type) && <span className="mt-2 flex flex-wrap gap-1.5">{[...getTicketSlaIndicators(ticket, slaPolicies), ...getCcgDeadlineIndicators(ticket)].map((indicator) => <span key={indicator.key} className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${indicator.state === "breached" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{indicator.label}</span>)}</span>}
                </span>
              </div>
              <span className="flex items-center justify-between gap-3 pl-[3.25rem] sm:justify-end sm:pl-0">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge value={ticket.status} />
                  <Badge value={ticket.priority} />
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-accent" />
              </span>
            </Link>
            {queueActions && <TicketQueueActions ticket={ticket} slaPolicies={slaPolicies} {...queueActions} />}
            </div>
            </div>
          </li>
        ))}
      </ul>
      )}
      {filteredTickets.length > pageSize && <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><span className="text-xs text-slate-500">Page {currentPage} of {pageCount}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Previous</button><button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Next<ChevronRight className="h-3.5 w-3.5" /></button></div></div>}
    </div>
  );
}
