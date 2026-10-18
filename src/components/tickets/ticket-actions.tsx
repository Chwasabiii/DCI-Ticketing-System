"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Route, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { TicketCommentForm } from "@/components/tickets/ticket-comment-form";
import { routeTicket, updateTicketStatus } from "@/lib/actions";
import type { Discipline, EmployeeRole, Profile, Ticket, TicketStatus } from "@/lib/types";

const ticketStatuses: TicketStatus[] = [
  "open",
  "under_review",
  "assigned",
  "in_progress",
  "waiting_for_info",
  "resolved",
  "closed",
  "rejected"
];

export function TicketActions({
  ticket,
  profile,
  roles,
  disciplines,
  people
}: {
  ticket: Ticket;
  profile: Profile;
  roles: EmployeeRole[];
  disciplines: Discipline[];
  people: Profile[];
}) {
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [routing, setRouting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [routingMessage, setRoutingMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [routingFailed, setRoutingFailed] = useState(false);
  const [statusFailed, setStatusFailed] = useState(false);
  const canRoute =
    profile.user_side === "admin" ||
    roles.includes("Coordinator") ||
    roles.includes("Discipline Lead");
  const canResolve =
    profile.user_side === "admin" ||
    roles.includes("Personnel") ||
    roles.includes("Discipline Lead");
  const isClient = profile.user_side === "client";
  const approvalBlocksWork =
    ticket.approval_status === "pending" || ticket.approval_status === "rejected";
  const editableStatuses = canResolve
    ? ticketStatuses
    : ticketStatuses.filter((status) => !["resolved", "closed", "rejected"].includes(status));
  const routingStatus = ["open", "under_review"].includes(ticket.status)
    ? "assigned"
    : ticket.status;

  async function handleRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (routing) return;

    setRouting(true);
    setRoutingMessage(null);
    setRoutingFailed(false);
    try {
      const result = await routeTicket(new FormData(event.currentTarget));
      if ("error" in result) {
        setRoutingFailed(true);
        setRoutingMessage(result.error ?? "The routing changes could not be saved.");
        return;
      }

      setRoutingMessage(result.success ?? "Routing changes saved.");
      router.refresh();
    } catch {
      setRoutingMessage("The routing changes could not be saved. Please try again.");
    } finally {
      setRouting(false);
    }
  }

  async function handleStatusUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (updatingStatus) return;

    const formData = new FormData(event.currentTarget);
    const nextStatus = String(formData.get("status") ?? "");
    if (["resolved", "closed", "rejected"].includes(nextStatus) && nextStatus !== ticket.status) {
      const label = nextStatus.replaceAll("_", " ");
      if (!await confirm({ title: `Mark ticket as ${label}?`, description: "This change will be visible to the requester and assigned staff.", confirmLabel: `Mark ${label}`, danger: nextStatus === "rejected" })) return;
    }

    setUpdatingStatus(true);
    setStatusMessage(null);
    setStatusFailed(false);
    try {
      const result = await updateTicketStatus(formData);
      if ("error" in result) {
        setStatusFailed(true);
        setStatusMessage(result.error ?? "The ticket status could not be updated.");
        return;
      }

      setStatusMessage(result.success ?? "Ticket status updated.");
      router.refresh();
    } catch {
      setStatusMessage("The ticket status could not be updated. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="grid gap-4">
      {confirmDialog}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_18px_rgba(20,40,75,0.035)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-navy">Handle this request</h2>
          <Badge value={ticket.status} />
        </div>
        <div className="grid gap-3">
          {approvalBlocksWork && (
            <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
              {ticket.approval_status === "pending"
                ? "Routing and work are paused until a project approver approves this request."
                : "This request was rejected by a project approver and cannot be routed."}
            </p>
          )}
          {canRoute && !approvalBlocksWork && (
            <form onSubmit={handleRoute} className="grid gap-3 border-b border-slate-100 pb-4">
              <p className="text-xs leading-5 text-slate-600">
                Review the request, choose its support group and priority, then assign an active employee.
              </p>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Support group
                <select
                  name="discipline_id"
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring"
                  defaultValue={ticket.discipline_id ?? ""}
                >
                  <option value="">Unassigned</option>
                  {disciplines.map((discipline) => (
                    <option key={discipline.id} value={discipline.id}>{discipline.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Assign to
                <select
                  name="assigned_to"
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring"
                  defaultValue={ticket.assigned_to ?? ""}
                >
                  <option value="">Leave unassigned</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name ?? person.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Priority
                <select
                  name="priority"
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring"
                  defaultValue={ticket.priority ?? "medium"}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Due date
                <input
                  name="due_date"
                  type="date"
                  defaultValue={ticket.due_date ?? ""}
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring"
                />
              </label>
              <input type="hidden" name="status" value={routingStatus} />
              {routingMessage && (
                <p role={routingFailed ? "alert" : "status"} className={`text-sm ${routingFailed ? "text-red-700" : "text-resolved"}`}>{routingMessage}</p>
              )}
              <Button type="submit" variant="secondary" loading={routing}>
                <Route className="h-4 w-4" />
                {routing ? "Saving..." : "Save routing"}
              </Button>
            </form>
          )}
          {(canRoute || canResolve) && !approvalBlocksWork && (
            <form onSubmit={handleStatusUpdate} className="grid gap-3">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Work status
                <select
                  name="status"
                  defaultValue={ticket.status}
                  className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring"
                >
                  {editableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              {canResolve && (
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Resolution summary
                  <textarea
                    name="resolution_notes"
                    rows={3}
                    defaultValue={ticket.resolution_notes ?? ""}
                    placeholder="Record what was done before marking resolved."
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal focus-ring"
                  />
                </label>
              )}
              {statusMessage && (
                <p role={statusFailed ? "alert" : "status"} className={`text-sm ${statusFailed ? "text-red-700" : "text-resolved"}`}>{statusMessage}</p>
              )}
              <Button type="submit" loading={updatingStatus}>
                <Save className="h-4 w-4" />
                {updatingStatus ? "Updating..." : "Update status"}
              </Button>
            </form>
          )}
          {isClient && ticket.status === "resolved" && (
            <form onSubmit={handleStatusUpdate}>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <input type="hidden" name="status" value="closed" />
              <Button type="submit" loading={updatingStatus}>
                <CheckCircle2 className="h-4 w-4" />
                Confirm completion
              </Button>
            </form>
          )}
        </div>
      </div>
      <TicketCommentForm
        ticketId={String(ticket.id)}
        allowInternalNotes={!isClient}
      />
    </div>
  );
}
