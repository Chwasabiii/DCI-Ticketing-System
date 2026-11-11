"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Search,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { useMemo } from "react";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import type { ServiceDashboardMetrics, ServiceTeam, Ticket, TicketSlaPolicy } from "@/lib/types";
import {
  getServiceTicketCategories,
  type ServiceDepartmentConfig
} from "@/lib/service-departments";
import {
  cn,
  formatDateTime,
  formatTicketCount,
  getCcgDeadlineIndicators,
  getTicketResolutionDueLabel,
  getTicketSlaIndicators,
  titleCase
} from "@/lib/utils";

type QueueView = "all" | "assigned" | "unassigned" | "overdue" | "awaiting-user" | "resolved-week";
type QueueTab = Extract<QueueView, "assigned" | "unassigned" | "all">;

const finalStatuses = ["resolved", "closed", "rejected"];
const resolvedStatuses = ["resolved", "closed"];
const pageSize = 20;

function isWithinCurrentWeek(value?: string | null) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const manilaOffset = 8 * 60 * 60 * 1000;
  const manilaToday = new Date(Date.now() + manilaOffset);
  const weekStartDay = Date.UTC(
    manilaToday.getUTCFullYear(),
    manilaToday.getUTCMonth(),
    manilaToday.getUTCDate() - ((manilaToday.getUTCDay() + 6) % 7)
  );
  const weekStart = weekStartDay - manilaOffset;
  return timestamp >= weekStart && timestamp < weekStart + 7 * 24 * 60 * 60 * 1000;
}

function relativeTime(value?: string | null) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "—";
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
    { unit: "year", seconds: 31_536_000 },
    { unit: "month", seconds: 2_592_000 },
    { unit: "week", seconds: 604_800 },
    { unit: "day", seconds: 86_400 },
    { unit: "hour", seconds: 3_600 },
    { unit: "minute", seconds: 60 },
    { unit: "second", seconds: 1 }
  ];
  const unit = units.find((item) => Math.abs(seconds) >= item.seconds) ?? units[units.length - 1];
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" })
    .format(Math.round(seconds / unit.seconds), unit.unit);
}

function averageLabel(value: number | null, unit: string) {
  return value === null ? "—" : `${value.toFixed(1)} ${unit}`;
}

function isOverdue(ticket: Ticket, slaPolicies: TicketSlaPolicy[]) {
  return [...getTicketSlaIndicators(ticket, slaPolicies), ...getCcgDeadlineIndicators(ticket)]
    .some((indicator) => indicator.state === "breached");
}

function getTicketCategoryLabels(ticket: Ticket, department: ServiceDepartmentConfig) {
  return getServiceTicketCategories(ticket, department).map((category) => category.label);
}

function StyledSelect({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-9 w-full appearance-none rounded-control border border-border bg-white py-1.5 pl-3 pr-9 text-sm text-ink focus-ring"
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </label>
  );
}

export function ServiceDashboard({
  tickets,
  currentUserId,
  department,
  slaPolicies,
  metrics,
  isAdmin = false,
  teams = [],
  selectedTeamId = null
}: {
  tickets: Ticket[];
  currentUserId: string;
  department: ServiceDepartmentConfig;
  slaPolicies: TicketSlaPolicy[];
  metrics: ServiceDashboardMetrics;
  isAdmin?: boolean;
  teams?: ServiceTeam[];
  selectedTeamId?: number | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const priorityFilter = searchParams.get("priority") ?? "";
  const categoryFilter = searchParams.get("category") ?? "";
  const requestedView = searchParams.get("view");
  const defaultView: QueueTab = metrics.assigned_to_me > 0 ? "assigned" : "unassigned";
  const validViews: QueueView[] = ["all", "assigned", "unassigned", "overdue", "awaiting-user", "resolved-week"];
  const view = validViews.find((validView) => validView === requestedView) ?? defaultView;
  const activeQueueTab: QueueTab = view === "assigned" || view === "unassigned" ? view : "all";

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

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return tickets.filter((ticket) => {
      const categories = getTicketCategoryLabels(ticket, department);
      const searchable = [
        ticket.ticket_no,
        ticket.title,
        ticket.requester?.full_name,
        ticket.requester?.email,
        ticket.assignee?.full_name,
        ticket.assignee?.email,
        ...categories,
        ticket.status,
        ticket.priority
      ];
      const isFinal = finalStatuses.includes(ticket.status);
      if (view === "assigned" && (isFinal || ticket.assigned_to !== currentUserId)) return false;
      if (view === "unassigned" && (isFinal || ticket.assigned_to)) return false;
      if (view === "overdue" && (isFinal || !isOverdue(ticket, slaPolicies))) return false;
      if (view === "awaiting-user" && ticket.status !== "waiting_for_info") return false;
      if (view === "resolved-week" && (!resolvedStatuses.includes(ticket.status) || !isWithinCurrentWeek(ticket.resolved_at))) return false;
      if (statusFilter && ticket.status !== statusFilter) return false;
      if (priorityFilter && ticket.priority !== priorityFilter) return false;
      if (categoryFilter && !getServiceTicketCategories(ticket, department)
        .some((category) => category.value === categoryFilter)) return false;
      return !normalizedQuery || searchable.some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
    }).sort((left, right) => {
      const leftFinal = finalStatuses.includes(left.status);
      const rightFinal = finalStatuses.includes(right.status);
      if (leftFinal !== rightFinal) return leftFinal ? 1 : -1;
      const overdueDifference = Number(isOverdue(right, slaPolicies)) - Number(isOverdue(left, slaPolicies));
      if (overdueDifference) return overdueDifference;
      const priorityDifference = Number(right.priority === "urgent") - Number(left.priority === "urgent");
      if (priorityDifference) return priorityDifference;
      const awaitingAgentStatuses = ["open", "assigned", "under_review", "in_progress"];
      const leftAwaitingAgent = awaitingAgentStatuses.includes(left.status);
      const rightAwaitingAgent = awaitingAgentStatuses.includes(right.status);
      if (leftAwaitingAgent !== rightAwaitingAgent) return leftAwaitingAgent ? -1 : 1;
      const leftWaiting = left.status === "waiting_for_info";
      const rightWaiting = right.status === "waiting_for_info";
      if (leftWaiting !== rightWaiting) return leftWaiting ? 1 : -1;
      return Date.parse(left.created_at ?? "") - Date.parse(right.created_at ?? "");
    });
  }, [tickets, department, query, statusFilter, priorityFilter, categoryFilter, view, currentUserId, slaPolicies]);

  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageCount = Math.max(1, Math.ceil(visibleTickets.length / pageSize));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, pageCount)
    : 1;
  const pageTickets = visibleTickets.slice((page - 1) * pageSize, page * pageSize);
  const categoryCounts = department.categories.map((category) => ({
    ...category,
    count: metrics.categories.find((item) => item.category === category.value)?.count ?? 0
  })).filter((category) => category.count > 0);
  const statusOptions = [...new Set(tickets.map((ticket) => ticket.status))].sort();
  const priorityOptions = [...new Set(tickets.map((ticket) => ticket.priority))].sort();
  const hasFilters = Boolean(query || statusFilter || priorityFilter || categoryFilter);
  const summary = [
    { label: "Unassigned", value: metrics.unassigned, view: "unassigned" as const, icon: UsersRound, tone: "bg-blue-50 text-primary" },
    { label: "Assigned to me", value: metrics.assigned_to_me, view: "assigned" as const, icon: UserRound, tone: "bg-violet-50 text-violet-700" },
    { label: "Overdue", value: metrics.overdue, view: "overdue" as const, icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
    { label: "Awaiting user", value: metrics.awaiting_user, view: "awaiting-user" as const, icon: Clock3, tone: "bg-amber-50 text-amber-800" },
    { label: "Resolved this week", value: metrics.resolved_this_week, view: "resolved-week" as const, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" }
  ];
  const queueTabs: Array<{ view: QueueTab; label: string; count: number }> = [
    { view: "assigned", label: "Assigned to me", count: metrics.assigned_to_me },
    { view: "unassigned", label: "Unassigned", count: metrics.unassigned },
    { view: "all", label: "All", count: metrics.total }
  ];

  function selectQueueTab(nextView: QueueTab) {
    updateParams({ view: nextView === defaultView ? "" : nextView });
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  }

  function updateDepartment(teamValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (teamValue) params.set("team", teamValue);
    else params.delete("team");
    params.delete("page");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  const exportHref = `/api/ticket-report.csv${selectedTeamId ? `?team=${selectedTeamId}` : ""}`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 sm:space-y-6">
      <header className="relative isolate overflow-hidden rounded-2xl bg-[#172b4d] p-5 text-white shadow-[0_12px_32px_rgba(18,33,58,0.12)] sm:p-7">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ backgroundImage: "radial-gradient(ellipse at 86% 12%, rgba(96, 165, 250, 0.2), transparent 42%), radial-gradient(ellipse at 55% 115%, rgba(16, 185, 129, 0.12), transparent 40%)" }}
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-100">{department.name}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/90">
              A clear view of ticket ownership, deadlines, and team workload.
            </p>
          </div>
          {isAdmin && (
            <label className="w-full sm:w-56">
              <span className="mb-1.5 block text-xs font-medium text-blue-100">Department</span>
              <StyledSelect label="Filter dashboard by department" value={selectedTeamId ? String(selectedTeamId) : ""} onChange={updateDepartment}>
                <option value="">All departments</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </StyledSelect>
            </label>
          )}
        </div>
      </header>

      <section aria-label="Ticket summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {summary.map((item) => {
            const active = view === item.view;
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={active}
                onClick={() => updateParams({ view: item.view === defaultView ? "" : item.view })}
                className={cn(
                  "flex min-h-[104px] items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-[0_4px_18px_rgba(20,40,75,0.035)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(20,40,75,0.08)] focus-ring sm:p-4",
                  active ? "border-primary/40 bg-blue-50/60 ring-1 ring-primary/15" : "border-slate-200/80"
                )}
              >
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", item.tone)}>
                  <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-2xl font-bold tabular-nums leading-none", item.label === "Overdue" && item.value > 0 ? "text-danger" : "text-navy")}>
                    {item.value}
                  </span>
                  <span className="mt-1.5 block text-xs font-medium leading-4 text-slate-600 sm:text-[13px]">{item.label}</span>
                </span>
              </button>
            );
          })}
      </section>

      <section aria-labelledby="queue-title" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-accent">
                <UsersRound aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h2 id="queue-title" className="font-bold text-navy">Ticket queue</h2>
                <p className="mt-0.5 text-xs text-slate-600">{formatTicketCount(metrics.total)} across {department.name}</p>
              </div>
            </div>
            <div role="tablist" aria-label="Ticket queue views" onKeyDown={handleTabKeyDown} className="flex max-w-full items-center gap-4 overflow-x-auto sm:gap-5">
              {queueTabs.map((tab) => (
                <button
                  key={tab.view}
                  type="button"
                  id={`queue-tab-${tab.view}`}
                  role="tab"
                  aria-controls="ticket-queue-panel"
                  aria-selected={activeQueueTab === tab.view}
                  tabIndex={activeQueueTab === tab.view ? 0 : -1}
                  onClick={() => selectQueueTab(tab.view)}
                  className={cn(
                    "min-h-10 shrink-0 border-b-2 px-1 text-sm font-semibold transition-colors hover:text-navy focus-ring",
                    activeQueueTab === tab.view ? "border-accent text-accent" : "border-transparent text-slate-600"
                  )}
                >
                  {tab.label} <span className="ml-1 tabular-nums text-slate-500">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_repeat(3,minmax(8.5rem,auto))_auto]">
            <label className="relative">
              <span className="sr-only">Search tickets</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => updateParams({ q: event.target.value })}
                placeholder="Search tickets"
                className="min-h-10 w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus-ring"
              />
            </label>
            <StyledSelect label="Filter by status" value={statusFilter} onChange={(value) => updateParams({ status: value })}>
              <option value="">All statuses</option>
              {statusOptions.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
            </StyledSelect>
            <StyledSelect label="Filter by priority" value={priorityFilter} onChange={(value) => updateParams({ priority: value })}>
              <option value="">All priorities</option>
              {priorityOptions.map((priority) => <option key={priority} value={priority}>{titleCase(priority)}</option>)}
            </StyledSelect>
            <StyledSelect label="Filter by category" value={categoryFilter} onChange={(value) => updateParams({ category: value })}>
              <option value="">All categories</option>
              {department.categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </StyledSelect>
            {hasFilters && (
              <button type="button" onClick={() => updateParams({ q: "", status: "", priority: "", category: "" })} className="inline-flex min-h-10 items-center justify-center gap-1 px-2 text-sm font-semibold text-slate-700 hover:text-navy focus-ring">
                <X aria-hidden="true" className="h-4 w-4" />Clear filters
              </button>
            )}
          </div>
        </div>

        <div
          id="ticket-queue-panel"
          role="tabpanel"
          aria-labelledby={`queue-tab-${activeQueueTab}`}
        >
        <div className="md:hidden">
          {pageTickets.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No tickets match these filters.</p>
          ) : pageTickets.map((ticket) => {
            const due = getTicketResolutionDueLabel(ticket, slaPolicies);
            return (
              <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="block border-b border-border px-4 py-3 transition-colors hover:bg-neutral-50 focus-ring">
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-ink">{ticket.title}</span>
                  <StatusBadge value={ticket.status} />
                </span>
                <span className="mt-1 block text-xs text-muted">{due}</span>
              </Link>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-slate-700">
              <tr className="h-10 border-b border-border">
                {["ID", "Subject", "Requester", "Category", "Priority", "Status", "Assignee", "Due", "Updated"].map((heading) => (
                  <th key={heading} scope="col" className="px-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageTickets.map((ticket) => {
                const categories = getTicketCategoryLabels(ticket, department);
                const due = getTicketResolutionDueLabel(ticket, slaPolicies);
                const href = `/tickets/${ticket.id}`;
                return (
                  <tr
                    key={ticket.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`${ticket.ticket_no ?? `Ticket ${ticket.id}`}: ${ticket.title}`}
                    onClick={() => router.push(href)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(href);
                      }
                    }}
                    className="h-12 cursor-pointer transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                  >
                    <td className="whitespace-nowrap px-3 font-mono text-xs tabular-nums text-accent">{ticket.ticket_no ?? `#${ticket.id}`}</td>
                    <td className="max-w-[18rem] truncate px-3 font-medium text-ink">
                      {ticket.title}
                    </td>
                    <td className="max-w-[12rem] truncate px-3 text-neutral-700" title={ticket.requester?.full_name || ticket.requester?.email || "Requester name unavailable"}>
                      {ticket.requester?.full_name || ticket.requester?.email || "Requester unavailable"}
                    </td>
                    <td className="px-3 text-neutral-700">{categories.join(", ")}</td>
                    <td className="px-3"><PriorityBadge value={ticket.priority} /></td>
                    <td className="px-3"><StatusBadge value={ticket.status} /></td>
                    <td
                      className={cn("px-3", ticket.assigned_to ? "text-neutral-700" : "text-muted")}
                      title={ticket.assigned_to ? ticket.assignee?.full_name || ticket.assignee?.email || "Assignee name unavailable" : undefined}
                    >
                      {ticket.assigned_to
                        ? ticket.assignee?.full_name || ticket.assignee?.email || "Assignee unavailable"
                        : "Unassigned"}
                    </td>
                    <td className="whitespace-nowrap px-3 text-xs text-neutral-700">{due}</td>
                    <td className="whitespace-nowrap px-3 text-xs text-neutral-700">
                      {ticket.updated_at
                        ? <time dateTime={ticket.updated_at} title={formatDateTime(ticket.updated_at)}>{relativeTime(ticket.updated_at)}</time>
                        : <span title="Update time unavailable">Unavailable</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pageTickets.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No tickets match these filters.</p>}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <span>{formatTicketCount(visibleTickets.length)}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })} className="inline-flex min-h-8 items-center gap-1 rounded-control border border-border px-2.5 hover:bg-neutral-50 focus-ring disabled:cursor-not-allowed disabled:opacity-50">
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />Previous
            </button>
            <span className="tabular-nums">{page} / {pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => updateParams({ page: String(page + 1) })} className="inline-flex min-h-8 items-center gap-1 rounded-control border border-border px-2.5 hover:bg-neutral-50 focus-ring disabled:cursor-not-allowed disabled:opacity-50">
              Next<ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
        </div>
      </section>

      <section aria-labelledby="workload-title" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(20,40,75,0.035)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="workload-title" className="text-base font-semibold text-ink">Workload</h2>
          {isAdmin && (
            <a href={exportHref} className="inline-flex min-h-9 items-center gap-2 rounded-control border border-border bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-ring">
              <Download aria-hidden="true" className="h-4 w-4" />Export CSV
            </a>
          )}
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {department.showResponseMetrics && (
            <section aria-labelledby="response-times-title">
              <h3 id="response-times-title" className="text-sm font-semibold text-neutral-800">Response times</h3>
              <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-control border border-border p-3">
                  <dt className="text-sm text-neutral-700">Average first response</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums text-ink" title={metrics.average_first_response_hours === null ? "No tickets have a recorded first response yet." : undefined}>
                    {averageLabel(metrics.average_first_response_hours, "hours")}
                  </dd>
                </div>
                <div className="rounded-control border border-border p-3">
                  <dt className="text-sm text-neutral-700">Average resolution</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums text-ink" title={metrics.average_resolution_days === null ? "No tickets have a recorded resolution yet." : undefined}>
                    {averageLabel(metrics.average_resolution_days, "days")}
                  </dd>
                </div>
              </dl>
            </section>
          )}
          <section aria-labelledby="category-counts-title">
            <h3 id="category-counts-title" className="text-sm font-semibold text-neutral-800">Open tickets by category</h3>
            <table className="mt-2 w-full text-left text-sm">
              <thead className="text-xs text-neutral-700">
                <tr className="border-b border-border"><th scope="col" className="py-2 font-medium">Category</th><th scope="col" className="py-2 text-right font-medium">Count</th></tr>
              </thead>
              <tbody>
                {categoryCounts.map((category) => (
                  <tr key={category.value} className="border-b border-border">
                    <th scope="row" className="py-2 font-normal text-neutral-800">{category.label}</th>
                    <td className="py-2 text-right tabular-nums text-neutral-800">{category.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th scope="row" className="pt-2 font-semibold text-ink">Total open tickets</th><td className="pt-2 text-right font-semibold tabular-nums text-ink">{metrics.open_total}</td></tr>
              </tfoot>
            </table>
          </section>
        </div>
      </section>
    </div>
  );
}
