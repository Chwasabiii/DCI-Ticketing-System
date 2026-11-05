"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { routeTicket, updateTicketStatus } from "@/lib/actions";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import type { Profile, Ticket } from "@/lib/types";

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
  canChangeStatus
}: {
  ticket: Ticket;
  employees: Profile[];
  canAssign: boolean;
  canChangeStatus: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [status, setStatus] = useState(ticket.status);
  const [assignee, setAssignee] = useState(ticket.assigned_to ?? "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  async function submitStatus() {
    if (status === "resolved" && ticket.status !== "resolved" && !await confirm({ title: "Resolve this ticket?", description: "The requester will be notified that the work is complete.", confirmLabel: "Resolve ticket" })) return;
    const form = new FormData();
    form.set("ticket_id", String(ticket.id));
    form.set("status", status);
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

  if (!canAssign && !canChangeStatus) return null;

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:pl-[4.75rem]">
      {confirmDialog}
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
          <select value={status} onChange={(event) => setStatus(event.target.value)} disabled={pending} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm focus-ring">
            {quickStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      )}
      {canAssign && <button type="button" onClick={submitAssignment} disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-navy px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}Assign</button>}
      {canChangeStatus && <button type="button" onClick={submitStatus} disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}Update status</button>}
      {message && <span role="status" className="w-full text-xs text-slate-600">{message}</span>}
    </div>
  );
}
