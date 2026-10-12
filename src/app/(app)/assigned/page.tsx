import { TicketTable } from "@/components/tickets/ticket-table";
import { getTickets } from "@/lib/data";

export default async function AssignedPage() {
  const tickets = (await getTickets(100)).filter((ticket) =>
    ["assigned", "in_progress", "waiting_for_info"].includes(ticket.status)
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-navy">Assigned Tickets</h1>
        <p className="mt-2 text-sm text-slate-600">
          Personnel workspace for active assignments, comments, uploads, and resolution updates.
        </p>
      </div>
      <TicketTable tickets={tickets} />
    </div>
  );
}
