"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Trash2 } from "lucide-react";
import { TicketTable } from "@/components/tickets/ticket-table";
import { bulkUpdateTickets } from "@/lib/actions";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import type { Profile, Ticket, TicketSlaPolicy } from "@/lib/types";
import { getTicketSlaIndicators, isTicketOverdue } from "@/lib/utils";

type TriageView = "all" | "unassigned" | "mine" | "overdue" | "resolved";
type SavedView = { id: string; name: string; view: TriageView; query: string; priority: string; status: string; priorityReview: string };
const savedViewsStorageKey = "pmsg-triage-saved-views-v1";

const views: Array<{ id: TriageView; label: string }> = [
  { id: "all", label: "All active" },
  { id: "unassigned", label: "Unassigned" },
  { id: "mine", label: "Assigned to me" },
  { id: "overdue", label: "Overdue" },
  { id: "resolved", label: "Resolved" }
];

const selectableStatuses = new Set([
  "open", "under_review", "assigned", "in_progress", "waiting_for_info"
]);
const statuses = ["open", "under_review", "assigned", "in_progress", "waiting_for_info", "resolved", "closed", "rejected"];

export function TicketTriageInbox({
  tickets,
  totalCount,
  page,
  pageSize,
  filters,
  currentUserId,
  slaPolicies = [],
  employees = [],
  canAssign = false,
  canChangeStatus = false,
  canBulkChangeStatus = false,
  canClaim = false
}: {
  tickets: Ticket[];
  totalCount: number;
  page: number;
  pageSize: number;
  filters: { view: TriageView; priority: string; status: string; needsPriorityReview: boolean; search: string };
  currentUserId: string;
  slaPolicies?: TicketSlaPolicy[];
  employees?: Profile[];
  canAssign?: boolean;
  canChangeStatus?: boolean;
  canBulkChangeStatus?: boolean;
  canClaim?: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveName, setSaveName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkStatus, setBulkStatus] = useState("in_progress");
  const [bulkFeedback, setBulkFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();
  const view = filters.view;

  function inboxHref(next: Partial<SavedView> & { page?: number | null } = {}) {
    const params = new URLSearchParams();
    const nextView = next.view ?? view;
    const nextSearch = next.query ?? filters.search;
    const nextPriority = next.priority ?? filters.priority;
    const nextStatus = next.status ?? filters.status;
    const nextReview = next.priorityReview ?? (filters.needsPriorityReview ? "needs_review" : "all");
    params.set("view", nextView);
    if (nextSearch) params.set("q", nextSearch);
    if (nextPriority !== "all") params.set("priority", nextPriority);
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextReview !== "all") params.set("review", nextReview);
    const nextPage = next.page === undefined ? 1 : next.page;
    if (nextPage !== null && nextPage > 1) params.set("page", String(nextPage));
    return `/inbox?${params.toString()}`;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(savedViewsStorageKey) ?? "[]") as SavedView[];
        setSavedViews(Array.isArray(stored) ? stored.filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && views.some((option) => option.id === item.view)).map((item) => ({ ...item, query: typeof item.query === "string" ? item.query : "", priority: item.priority ?? "all", status: item.status ?? "all", priorityReview: item.priorityReview ?? "all" })) : []);
      } catch { setSavedViews([]); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const slaIndicatorsByTicket = useMemo(
    () => new Map(tickets.map((ticket) => [ticket.id, getTicketSlaIndicators(ticket, slaPolicies)])),
    [tickets, slaPolicies]
  );

  function persistSavedViews(next: SavedView[]) {
    setSavedViews(next);
    localStorage.setItem(savedViewsStorageKey, JSON.stringify(next));
  }

  function saveCurrentView() {
    const name = saveName.trim();
    if (!name || (savedViews.length >= 10 && !savedViews.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()))) return;
    const next = [...savedViews.filter((item) => item.name.toLocaleLowerCase() !== name.toLocaleLowerCase()), {
      id: crypto.randomUUID(),
      name,
      view,
      query: filters.search,
      priority: filters.priority,
      status: filters.status,
      priorityReview: filters.needsPriorityReview ? "needs_review" : "all"
    }];
    persistSavedViews(next);
    setSaveName("");
  }

  async function applyBulk(operation: "assign" | "status") {
    if (!selectedIds.length) return;
    const selectedEmployee = employees.find((employee) => employee.id === bulkAssignee);
    const changeLabel = operation === "assign"
      ? bulkAssignee ? `assign them to ${selectedEmployee?.full_name || selectedEmployee?.email || "the selected employee"}` : "return them to the unassigned queue"
      : `move them to ${bulkStatus.replaceAll("_", " ")}`;
    const confirmed = await confirm({
      title: `${bulkStatus === "resolved" && operation === "status" ? "Resolve" : "Apply a change to"} ${selectedIds.length} ticket${selectedIds.length === 1 ? "" : "s"}?`,
      description: `This will ${changeLabel}. Review the selected tickets before proceeding.`,
      confirmLabel: `Apply to ${selectedIds.length} tickets`,
      danger: operation === "status" && bulkStatus === "resolved"
    });
    if (!confirmed) return;
    const form = new FormData();
    selectedIds.forEach((id) => form.append("ticket_ids", id));
    form.set("operation", operation);
    if (operation === "assign") form.set("assigned_to", bulkAssignee);
    else form.set("status", bulkStatus);
    setBulkFeedback(null);
    startBulkTransition(async () => {
      try {
        const result = await bulkUpdateTickets(form);
        if ("error" in result) setBulkFeedback({ type: "error", text: result.error ?? "Tickets could not be updated." });
        else {
          setBulkFeedback({ type: "success", text: result.success ?? "Tickets updated." });
          setSelectedIds([]);
          router.refresh();
        }
      } catch {
        setBulkFeedback({ type: "error", text: "Tickets could not be updated. Please try again." });
      }
    });
  }

  const visibleTickets = tickets;
  const bulkSelectableTickets = visibleTickets.filter((ticket) => selectableStatuses.has(ticket.status));
  const nextActions: Record<string, string> = Object.fromEntries(tickets.map((ticket): [string, string] => {
    let action = "Review request";
    if (ticket.status === "waiting_for_info") {
      action = ticket.requester_id === currentUserId ? "Waiting for requester" : "Reply to requester";
    } else if (ticket.status === "resolved") {
      action = "Waiting for requester confirmation";
    } else if (!ticket.assigned_to) {
      action = "Assign ticket";
    } else if (ticket.assigned_to === currentUserId) {
      action = "Update ticket status";
    } else {
      action = "Assigned to a teammate";
    }
    if (isTicketOverdue(ticket)) action = `Overdue - ${action}`;
    else if ((slaIndicatorsByTicket.get(ticket.id) ?? []).some((indicator) => indicator.state === "breached")) action = `SLA overdue - ${action}`;
    return [String(ticket.id), action];
  }));

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(20,40,75,0.035)] sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Saved views</p><div className="mt-2 flex flex-wrap gap-2">{savedViews.length ? savedViews.map((saved) => <span key={saved.id} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 ${view === saved.view && filters.search === saved.query && filters.priority === saved.priority && filters.status === saved.status && (filters.needsPriorityReview ? "needs_review" : "all") === saved.priorityReview ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}><button type="button" onClick={() => { setSelectedIds([]); router.push(inboxHref(saved)); }} className="text-xs font-semibold text-slate-700 hover:text-accent">{saved.name}</button><button type="button" onClick={() => persistSavedViews(savedViews.filter((item) => item.id !== saved.id))} aria-label={`Remove saved view ${saved.name}`} className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-urgent"><Trash2 className="h-3 w-3" /></button></span>) : <span className="text-xs text-slate-500">Save frequently used inbox filters for quick access.</span>}</div></div>
          <div className="flex w-full gap-2 sm:w-auto"><input value={saveName} maxLength={40} onChange={(event) => setSaveName(event.target.value)} placeholder="Name this view" aria-label="Saved view name" className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm focus-ring sm:w-44" /><button type="button" onClick={saveCurrentView} disabled={!saveName.trim() || (savedViews.length >= 10 && !savedViews.some((item) => item.name.toLocaleLowerCase() === saveName.trim().toLocaleLowerCase()))} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Bookmark className="h-4 w-4" /><span className="hidden sm:inline">Save current</span><span className="sm:hidden">Save</span></button></div>
        </div>
      </div>
      {confirmDialog}
      <div role="group" aria-label="Filter triage inbox" className="flex gap-2 overflow-x-auto pb-1">
        {views.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => { setSelectedIds([]); router.push(inboxHref({ view: id, status: "all" })); }}
              className={`focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors sm:px-4 ${
                view === id
                  ? "border-accent bg-blue-50 text-accent"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
        ))}
      </div>
      <form action="/inbox" method="get" className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_auto]">
        <input type="hidden" name="view" value={view} />
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Search tickets<input type="search" name="q" maxLength={100} defaultValue={filters.search} placeholder="Ticket number or title" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal focus-ring" /></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Priority<select name="priority" defaultValue={filters.priority} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal focus-ring"><option value="all">All priorities</option>{["urgent", "high", "medium", "low"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Status<select name="status" defaultValue={filters.status} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal focus-ring"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">Priority review<select name="review" defaultValue={filters.needsPriorityReview ? "needs_review" : "all"} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal focus-ring"><option value="all">All tickets</option><option value="needs_review">Needs review</option></select></label>
        <button type="submit" className="min-h-10 self-end rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-blue-700">Apply</button>
      </form>
      {bulkFeedback && <FeedbackMessage type={bulkFeedback.type}>{bulkFeedback.text}</FeedbackMessage>}
      {(canAssign || canChangeStatus) && bulkSelectableTickets.length > 0 && <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4">
        <label className="flex min-h-9 items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={bulkSelectableTickets.length > 0 && bulkSelectableTickets.every((ticket) => selectedIds.includes(String(ticket.id)))} onChange={(event) => setSelectedIds(event.target.checked ? bulkSelectableTickets.map((ticket) => String(ticket.id)) : [])} className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent" />Select visible tickets</label>
        {selectedIds.length > 0 && <span className="text-xs text-slate-500">{selectedIds.length} selected</span>}
        {selectedIds.length > 0 && canAssign && <div className="flex min-w-0 flex-1 gap-2"><select value={bulkAssignee} onChange={(event) => setBulkAssignee(event.target.value)} aria-label="Assign selected tickets to" className="min-h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm focus-ring"><option value="">Unassigned</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name || employee.email || "Employee"}</option>)}</select><button type="button" onClick={() => applyBulk("assign")} disabled={bulkPending || selectedIds.length > 50} className="min-h-9 rounded-lg bg-navy px-3 text-xs font-semibold text-white disabled:opacity-50">Assign</button></div>}
        {selectedIds.length > 0 && canBulkChangeStatus && <div className="flex min-w-0 flex-1 gap-2"><select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} aria-label="Set selected ticket status" className="min-h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm focus-ring">{["under_review", "assigned", "in_progress", "waiting_for_info", "resolved"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select><button type="button" onClick={() => applyBulk("status")} disabled={bulkPending || selectedIds.length > 50} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">Update</button></div>}
      </div>}
      <TicketTable
        tickets={visibleTickets}
        nextActions={nextActions}
        queueActions={{ employees, canAssign, canChangeStatus, canClaim, currentUserId }}
        selectedIds={selectedIds}
        selectableIds={bulkSelectableTickets.map((ticket) => String(ticket.id))}
        onToggleSelection={(id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 50 ? current : [...current, id])}
        slaPolicies={slaPolicies}
      />
      <nav aria-label="Inbox pagination" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-600">Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount} tickets</p>
        <div className="flex gap-2">
          {page > 1 ? <Link href={inboxHref({ page: page - 1 })} className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Previous</Link> : <span className="inline-flex min-h-9 items-center rounded-lg border border-slate-100 px-3 text-sm text-slate-400">Previous</span>}
          {page * pageSize < totalCount ? <Link href={inboxHref({ page: page + 1 })} className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Next</Link> : <span className="inline-flex min-h-9 items-center rounded-lg border border-slate-100 px-3 text-sm text-slate-400">Next</span>}
        </div>
      </nav>
    </section>
  );
}
