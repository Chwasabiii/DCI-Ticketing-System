"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, CircleCheck, LoaderCircle, Send, UserPlus } from "lucide-react";
import { claimTeamTicket, routeTicket, updateTicketStatus } from "@/lib/actions";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import type { Profile, Ticket, TicketSlaPolicy, TicketStatus } from "@/lib/types";
import { getTicketSlaIndicators } from "@/lib/utils";

const quickStatuses = [
  ["open", "Open"],
  ["under_review", "Under review"],
  ["assigned", "Assigned"],
  ["in_progress", "In progress"],
  ["waiting_for_info", "Waiting for info"],
  ["resolved", "Resolved"]
] as const;

export function TicketQueueActions({
  ticket,
  employees,
  canAssign,
  canChangeStatus,
  canClaim,
  currentUserId,
  slaPolicies,
  variant = "row"
}: {
  ticket: Ticket;
  employees: Profile[];
  canAssign: boolean;
  canChangeStatus: boolean;
  canClaim: boolean;
  currentUserId: string;
  slaPolicies: TicketSlaPolicy[];
  variant?: "row" | "panel";
}) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [status, setStatus] = useState<TicketStatus>(ticket.status as TicketStatus);
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolution_notes ?? "");
  const [assignee, setAssignee] = useState(ticket.assigned_to ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const activeTicket = !["resolved", "closed", "rejected"].includes(ticket.status);
  const slaAtRisk = getTicketSlaIndicators(ticket, slaPolicies)
    .some((indicator) => indicator.state === "warning" || indicator.state === "breached");
  const canClaimTicket = canClaim && activeTicket && ticket.assigned_to !== currentUserId
    && (!ticket.assigned_to || slaAtRisk);

  useEffect(() => {
    setStatus(ticket.status as TicketStatus);
    setResolutionNotes(ticket.resolution_notes ?? "");
    setMessage("");
  }, [ticket.status, ticket.resolution_notes]);

  async function submitClaim() {
    const isTakeover = Boolean(ticket.assigned_to);
    if (isTakeover && !await confirm({
      title: "Take over this ticket?",
      description: "The current owner will be replaced so you can help protect the ticket’s SLA.",
      confirmLabel: "Take over ticket"
    })) return;

    const form = new FormData();
    form.set("ticket_id", String(ticket.id));
    startTransition(async () => {
      const result = await claimTeamTicket(form);
      setMessage("error" in result ? result.error ?? "Could not claim ticket." : result.success ?? "Ticket assigned to you.");
      if (!("error" in result)) router.refresh();
    });
  }

  async function submitStatus(requestedStatus: TicketStatus = status) {
    if (requestedStatus === "resolved" && ticket.request_type === "incident_report" && !resolutionNotes.trim()) {
      setMessage("Add the inspection, root cause, and corrective action before resolving this incident.");
      return;
    }
    if (requestedStatus === "resolved" && ticket.status !== "resolved" && !await confirm({ title: "Submit this resolution?", description: "The requester will be notified that the ticket was resolved.", confirmLabel: "Submit resolution" })) return;
    const form = new FormData();
    form.set("ticket_id", String(ticket.id));
    form.set("status", requestedStatus);
    form.set("resolution_notes", resolutionNotes);
    startTransition(async () => {
      const result = await updateTicketStatus(form);
      setMessage("error" in result ? result.error ?? "Could not update status." : result.success ?? "Status updated.");
      if (!("error" in result)) router.refresh();
    });
  }

  function submitAssignment() {
    const form = new FormData();
    form.set("ticket_id", String(ticket.id));
    form.set("priority", String(ticket.priority));
    form.set("assigned_to", assignee);
    form.set("due_date", ticket.due_date ?? "");
    form.set("status", String(ticket.status));
    startTransition(async () => {
      const result = await routeTicket(form);
      setMessage("error" in result ? result.error ?? "Could not assign ticket." : result.success ?? "Assignment saved.");
      if (!("error" in result)) router.refresh();
    });
  }

  if (!canAssign && !canChangeStatus && !canClaimTicket) return null;

  const statusLabel = quickStatuses.find(([value]) => value === ticket.status)?.[1] ?? ticket.status;
  const statusControl = canChangeStatus && (
    <label className={`grid gap-1.5 text-xs font-semibold text-slate-600 ${variant === "panel" ? "w-full" : "min-w-40 flex-1"}`}>
      Status
      <select value={status} onChange={(event) => setStatus(event.target.value as TicketStatus)} disabled={pending} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus-ring">
        {quickStatuses.map(([value, label]) => (
          <option key={value} value={value}>
            {ticket.request_type === "incident_report" && value === "under_review"
              ? "IT inspection"
              : ticket.request_type === "incident_report" && value === "in_progress"
                ? "Root cause analysis"
                : label}
          </option>
        ))}
      </select>
    </label>
  );
  const resolutionControl = canChangeStatus && activeTicket && (
    <label className={`grid gap-1.5 text-xs font-semibold text-slate-600 ${variant === "panel" ? "w-full" : "min-w-56 flex-[2]"}`}>
      <span className="flex items-center justify-between gap-2">
        <span>{ticket.request_type === "incident_report" ? "Inspection and root cause findings" : "Resolution summary"}</span>
        <span className="font-normal text-slate-400">{resolutionNotes.length} characters</span>
      </span>
      <textarea
        value={resolutionNotes}
        onChange={(event) => setResolutionNotes(event.target.value)}
        rows={variant === "panel" ? 5 : 2}
        required={ticket.request_type === "incident_report"}
        placeholder={ticket.request_type === "incident_report" ? "Document the investigation and corrective action." : "Summarize the fix and any useful next steps…"}
        disabled={pending}
        className={`w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal leading-6 placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:outline-none disabled:bg-slate-50 ${variant === "panel" ? "min-h-32" : "min-h-20"}`}
      />
      {variant === "panel" && <span className="font-normal leading-5 text-slate-500">This summary will be shared with the requester when you submit the resolution.</span>}
    </label>
  );

  if (variant === "panel") {
    return (
      <div className="p-4 sm:p-5">
        {confirmDialog}
        {canClaimTicket && <button type="button" onClick={() => void submitClaim()} disabled={pending} className="mb-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 disabled:opacity-60">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{ticket.assigned_to ? "Take over ticket" : "Claim this ticket"}</button>}
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"><CircleCheck className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Current stage</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{statusLabel}</p>
          </div>
          <Check aria-hidden="true" className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="space-y-4">
          {statusControl}
          {resolutionControl}
        </div>
        {canChangeStatus && <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => void submitStatus()} disabled={pending} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}Save status update</button>
          {activeTicket && <button type="button" onClick={() => void submitStatus("resolved")} disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_5px_14px_rgba(37,99,235,0.22)] transition hover:bg-blue-700 disabled:opacity-60">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit resolution</button>}
        </div>}
        {message && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ${message.toLowerCase().includes("could not") || message.toLowerCase().includes("add the") ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"}`}>{message}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:pl-[4.75rem]">
      {confirmDialog}
      {canClaimTicket && <button type="button" onClick={() => void submitClaim()} disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{ticket.assigned_to ? "Take over ticket" : "Claim ticket"}</button>}
      {canAssign && variant === "row" && (
        <label className="grid min-w-48 flex-1 gap-1.5 text-xs font-semibold text-slate-600">
          Assign to
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={pending} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus-ring">
            <option value="">Unassigned</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name || employee.email || "Employee"}</option>)}
          </select>
        </label>
      )}
      {statusControl}
      {resolutionControl}
      {canAssign && variant === "row" && <button type="button" onClick={submitAssignment} disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">Assign ticket</button>}
      {canChangeStatus && <button type="button" onClick={() => void submitStatus()} disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">Update status</button>}
      {canChangeStatus && activeTicket && <button type="button" onClick={() => void submitStatus("resolved")} disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">Submit resolution</button>}
      {message && <span role="status" className="w-full text-xs text-slate-600">{message}</span>}
    </div>
  );
}
