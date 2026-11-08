import { TicketWorkloadView } from "@/components/tickets/ticket-workload-view";
import { getCurrentContext, getTicketSlaPolicies, getTickets } from "@/lib/data";

export default async function AssignedPage() {
  const [{ profile }, allTickets, slaPolicies] = await Promise.all([getCurrentContext(), getTickets(100), getTicketSlaPolicies()]);
  const tickets = allTickets.filter((ticket) =>
    ticket.assigned_to === profile?.id && ["assigned", "in_progress", "waiting_for_info"].includes(ticket.status)
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-navy">Assigned Tickets</h1>
        <p className="mt-2 text-sm text-slate-600">
          Personnel workspace for active assignments, comments, uploads, and resolution updates.
        </p>
      </div>
      <TicketWorkloadView tickets={tickets} currentUserId={profile?.id} slaPolicies={slaPolicies} />
    </div>
  );
}
