import { CheckCircle2, MessageSquare, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addComment, routeTicket, updateTicketStatus } from "@/lib/actions";
import type { Discipline, EmployeeRole, Profile, Ticket } from "@/lib/types";

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
  const canRoute =
    profile.user_side === "admin" ||
    roles.includes("Coordinator") ||
    roles.includes("Discipline Lead");
  const canResolve =
    profile.user_side === "admin" ||
    roles.includes("Personnel") ||
    roles.includes("Discipline Lead");
  const isClient = profile.user_side === "client";

  return (
    <div className="grid gap-4">
      <div className="rounded-lg bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-navy">Current state</h2>
          <Badge value={ticket.status} />
        </div>
        <div className="grid gap-3">
          {canRoute && (
            <form action={routeTicket} className="grid gap-3">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <select name="discipline_id" className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring" defaultValue={ticket.discipline_id ?? ""}>
                <option value="">Choose discipline</option>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </select>
              <select name="assigned_to" className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring" defaultValue={ticket.assigned_to ?? ""}>
                <option value="">Unassigned</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name ?? person.email}
                  </option>
                ))}
              </select>
              <select name="priority" className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring" defaultValue={ticket.priority ?? "normal"}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <input type="hidden" name="status" value="assigned" />
              <Button type="submit" variant="secondary">
                <Route className="h-4 w-4" />
                Route ticket
              </Button>
            </form>
          )}
          {canResolve && (
            <form action={updateTicketStatus}>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <input type="hidden" name="status" value="resolved" />
              <Button type="submit">
                <CheckCircle2 className="h-4 w-4" />
                Submit resolution
              </Button>
            </form>
          )}
          {isClient && ticket.status === "resolved" && (
            <form action={updateTicketStatus}>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <input type="hidden" name="status" value="closed" />
              <Button type="submit">
                <CheckCircle2 className="h-4 w-4" />
                Confirm completion
              </Button>
            </form>
          )}
        </div>
      </div>
      <form action={addComment} className="rounded-lg bg-white p-5 shadow-soft">
        <input type="hidden" name="ticket_id" value={ticket.id} />
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-slate-700">Add comment</span>
          <textarea name="body" rows={4} required className="rounded-md border border-slate-200 px-3 py-2 text-sm focus-ring" />
        </label>
        {!isClient && (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input name="is_internal" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            Internal note
          </label>
        )}
        <Button type="submit" className="mt-4">
          <MessageSquare className="h-4 w-4" />
          Post comment
        </Button>
      </form>
    </div>
  );
}
