"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import type { Ticket, TicketSlaPolicy } from "@/lib/types";
import {
  getServiceTicketCategory,
  type ServiceDepartmentConfig
} from "@/lib/service-departments";
import {
  cn,
  getTicketResolutionDueLabel,
  isTicketResolutionOverdue,
  titleCase
} from "@/lib/utils";

type QueueView = "all" | "assigned" | "unassigned" | "overdue" | "awaiting-user" | "resolved-week";

const queueViews: Array<{ value: QueueView; label: string }> = [
  { value: "assigned", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
  { value: "all", label: "All" }
];

const finalStatuses = ["resolved", "closed", "rejected"];
const pageSize = 10;

function isWithinCurrentWeek(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return date >= weekStart && date <= today;
}

function dueTone(label: string) {
  if (label.startsWith("Overdue")) return "text-danger";
  if (label === "Due today") return "text-warning";
  return "text-muted";
}

function relativeAverage(values: number[], unit: string) {
  if (values.length === 0) return "—";
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return `${average.toFixed(1)} ${unit}`;
}

export function ServiceDashboard({
  tickets,
  currentUserId,
  department,
  slaPolicies
}: {
  tickets: Ticket[];
  currentUserId: string;
  department: ServiceDepartmentConfig;
  slaPolicies: TicketSlaPolicy[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const priorityFilter = searchParams.get("priority") ?? "";
  const categoryFilter = searchParams.get("category") ?? "";
  const requestedView = searchParams.get("view");
  const knownViews: QueueView[] = ["all", "assigned", "unassigned", "overdue", "awaiting-user", "resolved-week"];
  const assignmentDataAvailable = tickets.some((ticket) => "assigned_to" in ticket);
  const resolvedDataAvailable = tickets.some((ticket) => "resolved_at" in ticket);
  const requestedQueueView = knownViews.includes(requestedView as QueueView)
    ? requestedView as QueueView
    : "all";
  const view: QueueView =
    (requestedQueueView === "assigned" || requestedQueueView === "unassigned")
      && !assignmentDataAvailable
      || requestedQueueView === "resolved-week" && !resolvedDataAvailable
      ? "all"
      : requestedQueueView;

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  const activeTickets = tickets.filter((ticket) => !finalStatuses.includes(ticket.status));
  const overdueCount = activeTickets.filter((ticket) =>
    isTicketResolutionOverdue(ticket, slaPolicies)
  ).length;
  const awaitingUserCount = tickets.filter((ticket) => ticket.status === "waiting_for_info").length;
  const assignedCount = assignmentDataAvailable
    ? activeTickets.filter((ticket) => ticket.assigned_to === currentUserId).length
    : null;
  const unassignedCount = assignmentDataAvailable
    ? activeTickets.filter((ticket) => !ticket.assigned_to).length
    : null;
  const resolvedThisWeek = resolvedDataAvailable
    ? tickets.filter((ticket) => finalStatuses.includes(ticket.status) && isWithinCurrentWeek(ticket.resolved_at)).length
    : null;

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return tickets.filter((ticket) => {
      const category = getServiceTicketCategory(ticket, department);
      const searchable = [
        ticket.ticket_no,
        ticket.title,
        category.label,
        ticket.status,
        ticket.priority
      ];

      if (view === "assigned" && ticket.assigned_to !== currentUserId) return false;
      if (view === "unassigned" && ticket.assigned_to) return false;
      if (view === "overdue" && !isTicketResolutionOverdue(ticket, slaPolicies)) return false;
      if (view === "awaiting-user" && ticket.status !== "waiting_for_info") return false;
      if (view === "resolved-week" && !isWithinCurrentWeek(ticket.resolved_at)) return false;

      return (!statusFilter || ticket.status === statusFilter)
        && (!priorityFilter || ticket.priority === priorityFilter)
        && (!categoryFilter || category.value === categoryFilter)
        && (!normalizedQuery || searchable.some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)));
    }).sort((left, right) => {
      const leftOverdue = isTicketResolutionOverdue(left, slaPolicies);
      const rightOverdue = isTicketResolutionOverdue(right, slaPolicies);
      if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;
      if (left.priority !== right.priority) {
        const rank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        const priorityDifference = (rank[right.priority] ?? 0) - (rank[left.priority] ?? 0);
        if (priorityDifference !== 0) return priorityDifference;
      }
      const leftWaiting = left.status === "waiting_for_info";
      const rightWaiting = right.status === "waiting_for_info";
      if (leftWaiting !== rightWaiting) return leftWaiting ? -1 : 1;
      return Date.parse(left.created_at ?? "") - Date.parse(right.created_at ?? "");
    });
  }, [tickets, department, query, statusFilter, priorityFilter, categoryFilter, view, currentUserId, slaPolicies]);

  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageCount = Math.max(1, Math.ceil(visibleTickets.length / pageSize));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, pageCount)
    : 1;
  const pageTickets = visibleTickets.slice((page - 1) * pageSize, page * pageSize);
  const categoryCounts = department.categories
    .map((category) => ({
      ...category,
      count: tickets.filter((ticket) => getServiceTicketCategory(ticket, department).value === category.value).length
    }))
    .filter((category) => category.count > 0);
  const responseHours = tickets.flatMap((ticket) => {
    if (!ticket.created_at || !ticket.first_response_at) return [];
    const hours = (Date.parse(ticket.first_response_at) - Date.parse(ticket.created_at)) / 3_600_000;
    return Number.isFinite(hours) && hours >= 0 ? [hours] : [];
  });
  const resolutionDays = tickets.flatMap((ticket) => {
    if (!ticket.created_at || !ticket.resolved_at) return [];
    const days = (Date.parse(ticket.resolved_at) - Date.parse(ticket.created_at)) / 86_400_000;
    return Number.isFinite(days) && days >= 0 ? [days] : [];
  });
  const statusOptions = [...new Set(tickets.map((ticket) => ticket.status))].sort();
  const priorityOptions = [...new Set(tickets.map((ticket) => ticket.priority))].sort();

  function setView(nextView: QueueView) {
    updateParams({ view: nextView === "all" ? "" : nextView });
  }

  const summary = [
    { label: "Unassigned", value: unassignedCount === null ? "—" : String(unassignedCount), view: "unassigned" as const, unavailable: !assignmentDataAvailable },
    { label: "Assigned to me", value: assignedCount === null ? "—" : String(assignedCount), view: "assigned" as const, unavailable: !assignmentDataAvailable },
    { label: "Overdue", value: String(overdueCount), view: "overdue" as const, tone: overdueCount > 0 ? "text-danger" : "text-muted" },
    { label: "Awaiting user", value: String(awaitingUserCount), view: "awaiting-user" as const },
    { label: "Resolved this week", value: resolvedThisWeek === null ? "—" : String(resolvedThisWeek), view: "resolved-week" as const, unavailable: !resolvedDataAvailable }
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">{department.name}</p>
        </div>
      </header>

      <section aria-label="Ticket summary" className="overflow-hidden rounded-control border border-border bg-surface">
        <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-5 sm:divide-y-0">
          {summary.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => !item.unavailable && setView(item.view)}
              disabled={item.unavailable}
              title={item.unavailable ? "This count is not included in the dashboard data." : `Show ${item.label.toLowerCase()} tickets`}
              className={cn(
                "min-h-16 px-3 py-2 text-left transition-colors duration-150 hover:bg-neutral-50 focus-ring disabled:cursor-not-allowed disabled:hover:bg-white sm:px-4",
                item.unavailable && "text-muted"
              )}
            >
              <span className={cn("block tabular-nums text-lg font-semibold text-ink", item.tone)}>
                {item.value}
              </span>
              <span className="block text-xs text-muted">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="queue-title" className="overflow-hidden rounded-control border border-border bg-surface">
        <div className="border-b border-border p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1" role="group" aria-label="Ticket queue views">
              {queueViews.map((item) => {
                const unavailable = item.value !== "all" && !assignmentDataAvailable;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={view === item.value}
                    disabled={unavailable}
                    onClick={() => setView(item.value)}
                    className={cn(
                      "min-h-9 rounded-control px-3 text-sm font-medium transition-colors duration-150 focus-ring disabled:cursor-not-allowed disabled:opacity-50",
                      view === item.value ? "bg-neutral-100 text-ink" : "text-muted hover:bg-neutral-50 hover:text-ink"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <p id="queue-title" className="text-sm font-semibold text-ink">Queue</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_repeat(3,minmax(9rem,auto))]">
            <label>
              <span className="sr-only">Search tickets</span>
              <input
                type="search"
                value={query}
                onChange={(event) => updateParams({ q: event.target.value })}
                placeholder="Search tickets"
                className="min-h-9 w-full rounded-control border border-border bg-white px-3 text-sm text-ink placeholder:text-muted focus-ring"
              />
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select value={statusFilter} onChange={(event) => updateParams({ status: event.target.value })} className="min-h-9 w-full rounded-control border border-border bg-white px-2 text-sm text-ink focus-ring">
                <option value="">All statuses</option>
                {statusOptions.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by priority</span>
              <select value={priorityFilter} onChange={(event) => updateParams({ priority: event.target.value })} className="min-h-9 w-full rounded-control border border-border bg-white px-2 text-sm text-ink focus-ring">
                <option value="">All priorities</option>
                {priorityOptions.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by category</span>
              <select value={categoryFilter} onChange={(event) => updateParams({ category: event.target.value })} className="min-h-9 w-full rounded-control border border-border bg-white px-2 text-sm text-ink focus-ring">
                <option value="">All categories</option>
                {department.categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {(!assignmentDataAvailable || !resolvedDataAvailable) && (
          <p className="border-b border-border px-4 py-2 text-xs text-muted">
            Assignment, requester, assignee, updated, and resolution-time details are not included in this dashboard&apos;s current ticket data.
          </p>
        )}

        <div className="md:hidden">
          {pageTickets.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              {visibleTickets.length === 0 ? "No tickets match these filters." : "No tickets on this page."}
            </p>
          ) : pageTickets.map((ticket) => {
            const due = getTicketResolutionDueLabel(ticket, slaPolicies);
            return (
              <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="block border-b border-border px-4 py-3 transition-colors duration-150 hover:bg-neutral-50 focus-ring">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs tabular-nums text-muted">{ticket.ticket_no ?? `#${ticket.id}`}</span>
                  <StatusBadge value={ticket.status} />
                </span>
                <span className="mt-1 block truncate text-sm font-medium text-ink">{ticket.title}</span>
                <span className={cn("mt-1 block text-xs", dueTone(due))}>{due}</span>
              </Link>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-medium text-muted">
              <tr className="h-10 border-b border-border">
                <th scope="col" className="px-4 font-medium">ID</th>
                <th scope="col" className="px-4 font-medium">Subject</th>
                <th scope="col" className="px-4 font-medium">Category</th>
                <th scope="col" className="px-4 font-medium">Priority</th>
                <th scope="col" className="px-4 font-medium">Status</th>
                <th scope="col" className="px-4 font-medium">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageTickets.map((ticket) => {
                const category = getServiceTicketCategory(ticket, department);
                const due = getTicketResolutionDueLabel(ticket, slaPolicies);
                return (
                  <tr key={ticket.id} className="h-11 transition-colors duration-150 hover:bg-neutral-50">
                    <td className="whitespace-nowrap px-4 font-mono text-xs tabular-nums text-muted">
                      {ticket.ticket_no ?? `#${ticket.id}`}
                    </td>
                    <td className="max-w-[32rem] px-4">
                      <Link href={`/tickets/${ticket.id}`} className="block truncate font-medium text-ink hover:text-primary focus-ring">
                        {ticket.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 text-muted">{category.label}</td>
                    <td className="whitespace-nowrap px-4"><PriorityBadge value={ticket.priority} /></td>
                    <td className="whitespace-nowrap px-4"><StatusBadge value={ticket.status} /></td>
                    <td className={cn("whitespace-nowrap px-4 text-xs", dueTone(due))}>{due}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pageTickets.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted">No tickets match these filters.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
          <span>{visibleTickets.length} tickets</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })} className="min-h-8 rounded-control border border-border px-2.5 transition-colors hover:bg-neutral-50 focus-ring disabled:cursor-not-allowed disabled:opacity-50">
              Previous
            </button>
            <span className="tabular-nums">{page} / {pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => updateParams({ page: String(page + 1) })} className="min-h-8 rounded-control border border-border px-2.5 transition-colors hover:bg-neutral-50 focus-ring disabled:cursor-not-allowed disabled:opacity-50">
              Next
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="workload-title" className="rounded-control border border-border bg-surface p-4 sm:p-5">
        <h2 id="workload-title" className="text-base font-semibold text-ink">Workload</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {department.showResponseMetrics && (
            <>
              <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2 sm:block">
                <dt className="text-sm text-muted">Average first response</dt>
                <dd className="text-sm font-medium tabular-nums text-ink">{relativeAverage(responseHours, "hours")}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2 sm:block">
                <dt className="text-sm text-muted">Average resolution</dt>
                <dd className="text-sm font-medium tabular-nums text-ink">{relativeAverage(resolutionDays, "days")}</dd>
              </div>
            </>
          )}
          {categoryCounts.map((category) => (
            <div key={category.value} className="flex items-baseline justify-between gap-3 border-b border-border pb-2 sm:block">
              <dt className="text-sm text-muted">{category.label}</dt>
              <dd className="text-sm font-medium tabular-nums text-ink">{category.count} tickets</dd>
            </div>
          ))}
          {categoryCounts.length === 0 && (
            <p className="text-sm text-muted">No tickets by category yet.</p>
          )}
        </dl>
        {department.showResponseMetrics && (!responseHours.length || !resolutionDays.length) && (
          <p className="mt-3 text-xs text-muted">
            Response and resolution averages require timestamps not present in the dashboard data.
          </p>
        )}
      </section>
    </div>
  );
}
