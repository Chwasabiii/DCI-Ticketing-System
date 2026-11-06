"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LoaderCircle, UserPlus } from "lucide-react";
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
  slaPolicies
}: {
  ticket: Ticket;
  employees: Profile[];
  canAssign: boolean;
  canChangeStatus: boolean;
  canClaim: boolean;
  currentUserId: string;
  slaPolicies: TicketSlaPolicy[];
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

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:pl-[4.75rem]">
      {confirmDialog}
      {canClaimTicket && <button type="button" onClick={() => void submitClaim()} disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{ticket.assigned_to ? "Take over ticket" : "Claim ticket"}</button>}
      {canAssign && (
        <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold text-slate-600">
          Assign to
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={pending} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus-ring">
            <option value="">Unassigned</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name || employee.email || "Employee"}</option>)}
          </select>
        </label>
      )}
      {canChangeStatus && (
        <label className="grid min-w-40 flex-1 gap-1 text-xs font-semibold text-slate-600">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as TicketStatus)} disabled={pending} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus-ring">
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
      )}
      {canChangeStatus && activeTicket && (
        <label className="grid min-w-56 flex-[2] gap-1 text-xs font-semibold text-slate-600">
          {ticket.request_type === "incident_report" ? "Inspection and root cause findings" : "Resolution summary"}
          <textarea
            value={resolutionNotes}
            onChange={(event) => setResolutionNotes(event.target.value)}
            rows={2}
            required={ticket.request_type === "incident_report"}
            placeholder={ticket.request_type === "incident_report" ? "Document the investigation and corrective action." : "Describe how the ticket was resolved."}
            disabled={pending}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-normal focus-ring"
          />
        </label>
      )}
      {canAssign && <button type="button" onClick={submitAssignment} disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-navy px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}Assign</button>}
      {canChangeStatus && <button type="button" onClick={() => void submitStatus()} disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}Update status</button>}
      {canChangeStatus && activeTicket && <button type="button" onClick={() => void submitStatus("resolved")} disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}Submit resolution</button>}
      {message && <span role="status" className="w-full text-xs text-slate-600">{message}</span>}
    </div>
  );
}
