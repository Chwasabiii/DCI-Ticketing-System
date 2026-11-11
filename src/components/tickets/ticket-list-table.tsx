"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import type { Ticket } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";

const pageSize = 10;
const sortOptions = ["updated", "created", "priority", "status", "category", "subject"] as const;
type SortOption = typeof sortOptions[number];

function categoryLabel(category: Ticket["service_category"]) {
  return titleCase((category ?? "other_services").replaceAll("_", " "));
}

function relativeTime(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;

  const seconds = (timestamp - Date.now()) / 1000;
  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
    { unit: "year", seconds: 31_536_000 },
    { unit: "month", seconds: 2_592_000 },
    { unit: "week", seconds: 604_800 },
    { unit: "day", seconds: 86_400 },
    { unit: "hour", seconds: 3_600 },
    { unit: "minute", seconds: 60 },
    { unit: "second", seconds: 1 }
  ];
  const { unit, seconds: unitSeconds } = units.find(({ seconds: threshold }) => Math.abs(seconds) >= threshold) ?? units[units.length - 1];
  const exact = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila"
  }).format(new Date(timestamp));

  return {
    relative: new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(seconds / unitSeconds), unit),
    exact
  };
}

export function TicketListTable({ tickets, createTicketHref }: { tickets: Ticket[]; createTicketHref?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  const query = params.get("q") ?? "";
  const statusFilter = params.get("status") ?? "";
  const priorityFilter = params.get("priority") ?? "";
  const categoryFilter = params.get("category") ?? "";
  const sortValue = params.get("sort");
  const sortBy: SortOption = sortOptions.includes(sortValue as SortOption) ? sortValue as SortOption : "updated";
  const requestedPage = Number.parseInt(params.get("page") ?? "1", 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const statuses = [...new Set(tickets.map((ticket) => ticket.status))].sort();
  const priorities = [...new Set(tickets.map((ticket) => String(ticket.priority)))].sort();
  const categories = [...new Set(tickets.map((ticket) => String(ticket.service_category ?? "")))].filter(Boolean).sort();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredTickets = tickets.filter((ticket) => {
    const searchableFields = [ticket.ticket_no, ticket.title, ticket.status, ticket.priority, ticket.service_category];
    return (!statusFilter || ticket.status === statusFilter)
      && (!priorityFilter || ticket.priority === priorityFilter)
      && (!categoryFilter || ticket.service_category === categoryFilter)
      && (!normalizedQuery || searchableFields.some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)));
  }).sort((a, b) => {
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
  const pageCount = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleTickets = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Keep the list state in the URL so it survives refreshes and can be shared.
  function updateParams(updates: Record<string, string>, resetPage = true) {
    const nextParams = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
    }
    if (resetPage && !("page" in updates)) nextParams.delete("page");
    const queryString = nextParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  const selectClassName = "min-h-9 rounded-control border border-border bg-surface px-2 text-sm text-ink focus-ring";

  return (
    <section className="overflow-hidden rounded-control border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted" aria-live="polite">
            {filteredTickets.length
              ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredTickets.length)} of ${filteredTickets.length} tickets`
              : `${filteredTickets.length} tickets`}
          </p>
          <label className="w-full sm:max-w-xs">
            <span className="sr-only">Search tickets</span>
            <input
              type="search"
              value={query}
              onChange={(event) => updateParams({ q: event.target.value })}
              placeholder="Search tickets"
              className="min-h-9 w-full rounded-control border border-border bg-surface px-3 text-body text-ink placeholder:text-muted focus-ring"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <label className="sr-only" htmlFor="ticket-status-filter">Filter by status</label>
          <select id="ticket-status-filter" value={statuses.includes(statusFilter) ? statusFilter : ""} onChange={(event) => updateParams({ status: event.target.value })} className={selectClassName}>
            <option value="">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
          </select>
          <label className="sr-only" htmlFor="ticket-priority-filter">Filter by priority</label>
          <select id="ticket-priority-filter" value={priorities.includes(priorityFilter) ? priorityFilter : ""} onChange={(event) => updateParams({ priority: event.target.value })} className={selectClassName}>
            <option value="">All priorities</option>
            {priorities.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
          </select>
          <label className="sr-only" htmlFor="ticket-category-filter">Filter by category</label>
          <select id="ticket-category-filter" value={categories.includes(categoryFilter) ? categoryFilter : ""} onChange={(event) => updateParams({ category: event.target.value })} className={selectClassName}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}
          </select>
          <label className="sr-only" htmlFor="ticket-sort">Sort tickets</label>
          <select id="ticket-sort" value={sortBy} onChange={(event) => updateParams({ sort: event.target.value })} className={selectClassName}>
            <option value="updated">Last updated</option>
            <option value="created">Newest created</option>
            <option value="priority">Priority</option>
            <option value="status">Status</option>
            <option value="category">Category</option>
            <option value="subject">Subject</option>
          </select>
        </div>
      </div>
      {tickets.length === 0 ? (
        <div className="flex flex-col items-start gap-3 px-4 py-8">
          <p className="text-sm text-ink">No tickets yet. Create a ticket to get help.</p>
          {createTicketHref && <Link href={createTicketHref} className="focus-ring inline-flex min-h-9 items-center rounded-control bg-primary px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover">Create ticket</Link>}
        </div>
      ) : visibleTickets.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-8 text-sm text-muted">
          <p>No tickets match these filters.</p>
          <button type="button" onClick={() => updateParams({ q: "", status: "", priority: "", category: "" })} className="focus-ring rounded-control px-2 py-1 font-medium text-primary transition-colors duration-150 hover:bg-neutral-50">Clear filters</button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border md:hidden">
            {visibleTickets.map((ticket) => {
              const updated = relativeTime(ticket.updated_at ?? ticket.created_at);
              // The list query returns assignment IDs, not permission-scoped profile names.
              const assignee = ticket.assignee?.full_name ?? (ticket.assigned_to ? "Assigned" : "Unassigned");
              return (
                <li key={ticket.id}>
                  <Link href={`/tickets/${ticket.id}`} className="focus-ring block px-4 py-3 transition-colors duration-150 hover:bg-neutral-50">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs tabular-nums text-muted">{ticket.ticket_no ?? `#${ticket.id}`}</span>
                      <time className="text-xs text-muted" dateTime={ticket.updated_at ?? ticket.created_at ?? undefined} title={updated?.exact}>{updated?.relative ?? "Not updated"}</time>
                    </span>
                    <span className="mt-1 block truncate text-sm font-medium text-ink">{ticket.title}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge value={ticket.status} />
                      <PriorityBadge value={ticket.priority} />
                      <span className="text-xs text-muted">{categoryLabel(ticket.service_category)}</span>
                      <span className="ml-auto max-w-32 truncate text-xs text-muted">{assignee}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[29%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
                <col className="w-[15%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead className="bg-neutral-50 text-xs font-medium text-muted">
                <tr>
                  {["Ticket", "Subject", "Status", "Priority", "Category", "Assignee", "Last updated"].map((heading) => (
                    <th key={heading} scope="col" className="border-b border-border px-3 py-2.5 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleTickets.map((ticket) => {
                  const updated = relativeTime(ticket.updated_at ?? ticket.created_at);
                  // The list query returns assignment IDs, not permission-scoped profile names.
                  const assignee = ticket.assignee?.full_name ?? (ticket.assigned_to ? "Assigned" : "Unassigned");
                  return (
                    <tr key={ticket.id} className="transition-colors duration-150 hover:bg-neutral-50">
                      <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted">{ticket.ticket_no ?? `#${ticket.id}`}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/tickets/${ticket.id}`} className="focus-ring block truncate font-medium text-ink hover:text-primary" title={ticket.title}>{ticket.title}</Link>
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge value={ticket.status} /></td>
                      <td className="px-3 py-2.5"><PriorityBadge value={ticket.priority} /></td>
                      <td className="truncate px-3 py-2.5 text-sm text-ink" title={categoryLabel(ticket.service_category)}>{categoryLabel(ticket.service_category)}</td>
                      <td className="truncate px-3 py-2.5 text-sm text-muted" title={assignee}>{assignee}</td>
                      <td className="px-3 py-2.5 text-xs text-muted">
                        {updated
                          ? <time dateTime={ticket.updated_at ?? ticket.created_at ?? undefined} title={updated.exact}>{updated.relative}</time>
                          : "Not updated"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {filteredTickets.length > pageSize && (
        <div className="flex items-center justify-between border-t border-border px-3 py-2.5">
          <span className="text-xs tabular-nums text-muted">Page {currentPage} of {pageCount}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => updateParams({ page: String(Math.max(1, currentPage - 1)) }, false)} disabled={currentPage <= 1} className={cn("inline-flex min-h-8 items-center gap-1 rounded-control border border-border px-2.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50")}><ChevronLeft className="h-4 w-4" strokeWidth={1.75} />Previous</button>
            <button type="button" onClick={() => updateParams({ page: String(Math.min(pageCount, currentPage + 1)) }, false)} disabled={currentPage >= pageCount} className={cn("inline-flex min-h-8 items-center gap-1 rounded-control border border-border px-2.5 text-xs font-medium text-ink transition-colors duration-150 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50")}>Next<ChevronRight className="h-4 w-4" strokeWidth={1.75} /></button>
          </div>
        </div>
      )}
    </section>
  );
}
