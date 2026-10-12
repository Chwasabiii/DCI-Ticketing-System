"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Route, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const [routing, setRouting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [routingMessage, setRoutingMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const canRoute =
    profile.user_side === "admin" ||
    roles.includes("Coordinator") ||
    roles.includes("Discipline Lead");
  const canResolve =
    profile.user_side === "admin" ||
    roles.includes("Personnel") ||
    roles.includes("Discipline Lead");
  const isClient = profile.user_side === "client";
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
    try {
      const result = await routeTicket(new FormData(event.currentTarget));
      if ("error" in result) {
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

    setUpdatingStatus(true);
    setStatusMessage(null);
    try {
      const result = await updateTicketStatus(new FormData(event.currentTarget));
      if ("error" in result) {
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
      <div className="rounded-lg bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-navy">Handle this request</h2>
          <Badge value={ticket.status} />
        </div>
        <div className="grid gap-3">
          {canRoute && (
            <form onSubmit={handleRoute} className="grid gap-3 border-b border-slate-100 pb-4">
              <p className="text-xs leading-5 text-slate-600">
                Review the request, choose its support group and priority, then assign an active employee.
              </p>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Support group
                <select
                  name="discipline_id"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal focus-ring"
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
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal focus-ring"
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
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal focus-ring"
                  defaultValue={ticket.priority ?? "medium"}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <input type="hidden" name="status" value={routingStatus} />
              {routingMessage && (
                <p role="status" className="text-sm text-slate-600">{routingMessage}</p>
              )}
              <Button type="submit" variant="secondary" disabled={routing}>
                <Route className="h-4 w-4" />
                {routing ? "Saving..." : "Save routing"}
              </Button>
            </form>
          )}
          {(canRoute || canResolve) && (
            <form onSubmit={handleStatusUpdate} className="grid gap-3">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Work status
                <select
                  name="status"
                  defaultValue={ticket.status}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal focus-ring"
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
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm font-normal focus-ring"
                  />
                </label>
              )}
              {statusMessage && (
                <p role="status" className="text-sm text-slate-600">{statusMessage}</p>
              )}
              <Button type="submit" disabled={updatingStatus}>
                <Save className="h-4 w-4" />
                {updatingStatus ? "Updating..." : "Update status"}
              </Button>
            </form>
          )}
          {isClient && ticket.status === "resolved" && (
            <form onSubmit={handleStatusUpdate}>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <input type="hidden" name="status" value="closed" />
              <Button type="submit" disabled={updatingStatus}>
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
